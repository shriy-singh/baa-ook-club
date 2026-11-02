// TEMPORARY diagnostic: shows which Gemini-related variable NAMES this deployment can see (never values).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const names = Object.keys(process.env).filter((k) => /gemini|google|api[_-]?key/i.test(k));
  const key = process.env.GEMINI_API_KEY;
  return Response.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    hasGeminiKey: Boolean(key),
    keyLength: key?.length ?? 0,
    keyHasOuterSpaces: key ? key !== key.trim() : false,
    keyHasQuotes: key ? /^["']|["']$/.test(key) : false,
    // JSON-quoted so stray spaces or odd characters in a name are visible
    similarNames: names.map((n) => JSON.stringify(n)),
  });
}
