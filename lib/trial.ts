// Server-only: the website's free trial. Each browser gets FREE_BOOKS books a month on the site's own
// Gemini key, tracked in one signed cookie (no accounts, nothing stored on a server). After that, or in
// regions where Gemini's terms only allow paid keys for public apps, visitors bring their own key.
import crypto from "node:crypto";

export const FREE_BOOKS = 3;
/** Answers per free book (including the opening), so one visitor can't use up the day's shared voice quota. */
export const ASKS_PER_BOOK = 12;
/** Voice clips per free book (each answer is voiced in two parts, plus replays). */
export const SPEAKS_PER_BOOK = 40;

export const TRIAL_COOKIE = "bc_trial";

// Gemini's terms: apps offered to people in the EEA, Switzerland or the UK may only use paid services.
const PAID_ONLY = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
  "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH", "GB",
]);

export type TrialState = {
  /** Month the count belongs to, e.g. "2026-11". */
  m: string;
  /** Free books used this month. */
  n: number;
  /** The current free book's Gemini file name, e.g. "files/abc123". */
  f: string | null;
  q: number;
  s: number;
};

export type NeedKeyReason = "region" | "books" | "asks";

const month = () => new Date().toISOString().slice(0, 7);

function secret() {
  // A dedicated secret if set; otherwise derived from the site's Gemini key so no extra setup is needed.
  const base = process.env.TRIAL_SECRET || `trial:${process.env.GEMINI_API_KEY ?? "dev"}`;
  return crypto.createHash("sha256").update(base).digest();
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

/** The visitor's trial cookie if present and correctly signed, otherwise null. */
export function readTrialCookie(req: Request): TrialState | null {
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${TRIAL_COOKIE}=([^;]+)`))?.[1];
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as TrialState;
  } catch {
    return null;
  }
}

/** This month's trial state; missing, forged or last month's cookies count as a fresh start. */
export function readTrial(req: Request): TrialState {
  const state = readTrialCookie(req);
  return state && state.m === month() ? state : { m: month(), n: 0, f: null, q: 0, s: 0 };
}

export function trialCookie(state: TrialState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TRIAL_COOKIE}=${payload}.${sign(payload)}; Path=/; Max-Age=${40 * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`;
}

/** Country from Vercel's request header (not stored). TRIAL_COUNTRY overrides it for local testing. */
export function countryOf(req: Request) {
  return (process.env.TRIAL_COUNTRY || req.headers.get("x-vercel-ip-country") || "").toUpperCase() || null;
}

export const paidOnlyRegion = (country: string | null) => !!country && PAID_ONLY.has(country);

/** The visitor's own Gemini key, if they added one (sent per request, never stored or logged). */
export function ownKey(req: Request) {
  const key = req.headers.get("x-gemini-key")?.trim();
  return key || null;
}

const MESSAGES: Record<NeedKeyReason, string> = {
  region:
    "In your region, Gemini's rules don't allow free shared keys for public sites, so the club needs your own free Gemini key.",
  books: `You've used your ${FREE_BOOKS} free books this month. Add your own free Gemini key to keep going.`,
  asks: "That's all the free questions for this book. Add your own free Gemini key to keep chatting.",
};

export function needKey(reason: NeedKeyReason) {
  return Response.json({ error: MESSAGES[reason], needKey: true, reason }, { status: 403 });
}

/** Attaches the updated trial cookie to a response. */
export function withTrial(res: Response, state: TrialState) {
  res.headers.append("Set-Cookie", trialCookie(state));
  return res;
}

/** "https://…/v1beta/files/abc" or "files/abc" → "files/abc". */
export function fileName(uriOrName: string) {
  return uriOrName.match(/files\/[\w-]+/)?.[0] ?? null;
}
