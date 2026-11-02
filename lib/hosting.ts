// What the hosts say and how they sound, shared by the server routes (web app) and the browser
// (extension, where each person brings their own Gemini key). No Node-only APIs in here.
import { VOICES, getCharacter, type Character } from "./characters";

// Flash-Lite answers in ~3s on the free tier; gemini-3.8-flash took 45s+ in testing (Nov 2026).
export const DEFAULT_TEXT_MODEL = "gemini-3.5-flash-lite";
// The lite TTS is ~4.5s per answer versus ~7s for gemini-3.8-flash-tts, which is a bit more expressive.
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-lite-tts";

// Free-tier models sometimes return 503 "high demand"; give up quickly with a clear message instead of hanging.
export const REQUEST_TIMEOUT_MS = 45_000;

export const INTRO_REQUEST =
  "Open the episode. In two or three sentences, welcome the listener, name the book and its author if you can tell, say in one line what it is about, and invite them to ask you anything about it.";

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

export type AskArgs = { fileUri: string; mimeType?: string; question?: string; previousId?: string; host?: string };
export type SpeakArgs = { text: string; voice?: string; host?: string };

// The first call sends the book itself; follow-ups chain on previous_interaction_id so Gemini keeps the conversation.
export function askRequest({ fileUri, mimeType, question, previousId, host }: AskArgs, model: string) {
  const text = question?.trim() || INTRO_REQUEST;
  const input = previousId
    ? [{ type: "text" as const, text }]
    : [
        { type: "document" as const, uri: fileUri, mime_type: (mimeType || "application/pdf") as "application/pdf" },
        { type: "text" as const, text },
      ];
  return { model, system_instruction: hostPrompt(getCharacter(host)), input, previous_interaction_id: previousId };
}

export function speakRequest({ text, voice, host: hostId }: SpeakArgs, model: string) {
  const host = getCharacter(hostId);
  // An explicit pick from the voice menu wins; otherwise each host has their own voice.
  const chosen = VOICES.some((v) => v.id === voice) ? voice! : host.voice;
  return {
    model,
    input: [
      {
        type: "user_input" as const,
        content: [{ type: "text" as const, text, annotations: [{ type: "speech_metadata" as const, style: host.voiceStyle }] }],
      },
    ],
    response_format: { type: "audio" as const },
    generation_config: { speech_config: [{ voice: chosen }] },
    stream: false as const,
  };
}

/** Turns Gemini's base64 audio into WAV bytes; raw PCM (audio/l16) gets a WAV header so browsers can play it. */
export function audioToWav(audio: { data?: string; mime_type?: string; sample_rate?: number }) {
  if (!audio.data) throw new Error("No audio came back from Gemini.");
  const bin = atob(audio.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (String(audio.mime_type || "audio/wav").includes("wav")) return bytes;

  const rate = audio.sample_rate || 24000;
  const out = new Uint8Array(44 + bytes.length);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + bytes.length, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, bytes.length, true);
  out.set(bytes, 44);
  return out;
}

export function errorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  if (status === 429) return "You've hit Gemini's free-tier limit for now. Wait a minute and ask again.";
  if (status === 503) return "Gemini is very busy right now. Ask again in a moment.";
  if (status === 400 && /api key/i.test(message)) return "Gemini didn't accept that API key. Check it and try again.";
  if (/timed? ?out|aborted/i.test(message)) return "Gemini took too long to answer. Ask again in a moment.";
  return message;
}
