// Server-only Gemini setup for the web app's API routes.
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_TEXT_MODEL, DEFAULT_TTS_MODEL } from "./hosting";

export { REQUEST_TIMEOUT_MS, errorMessage } from "./hosting";

// Both can be overridden in .env.local if Google renames or retires a model.
export const TEXT_MODEL = process.env.GEMINI_MODEL || DEFAULT_TEXT_MODEL;
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;

export const MISSING_KEY =
  "GEMINI_API_KEY is missing. Locally, add it to .env.local and restart; on Vercel, add it under Settings > Environment Variables (Production) and redeploy.";

/** The site's own key (used for free-trial requests). */
export function siteKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error(MISSING_KEY);
  return apiKey;
}

/** A Gemini client for this request: the visitor's own key if they sent one, otherwise the site's. */
export function gemini(apiKey: string = siteKey()) {
  return new GoogleGenAI({ apiKey });
}
