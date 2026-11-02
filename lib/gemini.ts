// Server-only Gemini setup for the web app's API routes, using the deployment's own key.
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_TEXT_MODEL, DEFAULT_TTS_MODEL } from "./hosting";

export { REQUEST_TIMEOUT_MS, errorMessage } from "./hosting";

// Both can be overridden in .env.local if Google renames or retires a model.
export const TEXT_MODEL = process.env.GEMINI_MODEL || DEFAULT_TEXT_MODEL;
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;

export const MISSING_KEY =
  "GEMINI_API_KEY is missing. Locally, add it to .env.local and restart; on Vercel, add it under Settings > Environment Variables (Production) and redeploy.";

export function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error(MISSING_KEY);
  return new GoogleGenAI({ apiKey });
}
