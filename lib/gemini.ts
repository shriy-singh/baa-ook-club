import { GoogleGenAI } from "@google/genai";
import type { Character } from "./characters";

// All three can be overridden in .env.local if Google renames or retires a model.
// Flash-Lite answers in ~3s on the free tier; gemini-3.8-flash took 45s+ in testing (Nov 2026).
export const TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
// The lite TTS is ~4.5s per answer versus ~7s for gemini-3.8-flash-tts, which is a bit more expressive.
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";

// Free-tier models sometimes return 503 "high demand"; give up quickly with a clear message instead of hanging.
export const REQUEST_TIMEOUT_MS = 45_000;

export function hostPrompt(host: Character) {
  return `You are ${host.persona}
You host a cozy book podcast called "Baa-ook Club". The listener has given you a book (the attached PDF) and is asking you questions about it, out loud.

How you answer:
- Base every answer on the book. If the book does not cover something, say so honestly, in character, and offer what the book does say that is closest.
- Your words will be read aloud, so write the way people speak: no markdown, no bullet points, no headings, no emojis, no stage directions.
- Keep it short: two to four sentences, about 60 words, unless the listener asks for more detail.
- When it helps, mention the chapter or page, or quote a short line from the book.
- Earlier answers in this conversation may have come from a different host. You have taken over the show; answer as yourself and don't mention the switch unless asked.`;
}

export const INTRO_REQUEST =
  "Open the episode. In two or three sentences, welcome the listener, name the book and its author if you can tell, say in one line what it is about, and invite them to ask you anything about it.";

export function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  return new GoogleGenAI({ apiKey });
}

export function errorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  if (status === 429) return "You've hit Gemini's free-tier limit for now. Wait a minute and ask again.";
  if (status === 503) return "Gemini is very busy right now. Ask again in a moment.";
  if (/timed? ?out|aborted/i.test(message)) return "Gemini took too long to answer. Ask again in a moment.";
  return message;
}
