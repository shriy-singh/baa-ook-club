// How the Studio talks to Gemini. The website goes through its own API routes (free trial on the site's key,
// or the visitor's own key); the browser extension calls Gemini directly with the visitor's own key.
import { GoogleGenAI } from "@google/genai";
import {
  DEFAULT_TEXT_MODEL,
  DEFAULT_TTS_MODEL,
  REQUEST_TIMEOUT_MS,
  askRequest,
  audioToWav,
  errorMessage,
  speakRequest,
  type AskArgs,
  type SpeakArgs,
} from "./hosting";

export type Backend = {
  upload(file: File): Promise<{ uri: string; mimeType: string }>;
  ask(args: AskArgs): Promise<{ text: string; id: string }>;
  /** WAV bytes, ready for AudioContext.decodeAudioData. */
  speak(args: SpeakArgs): Promise<ArrayBuffer>;
};

/** The website's free trial is over (or not offered in this region): the visitor needs their own key. */
export class NeedKeyError extends Error {
  constructor(message: string, readonly reason: "region" | "books" | "asks") {
    super(message);
  }
}

async function fail(res: Response): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string; needKey?: boolean; reason?: NeedKeyError["reason"] };
  if (data.needKey && data.reason) throw new NeedKeyError(data.error ?? "Add your own Gemini key to keep going.", data.reason);
  throw new Error(data.error || "Something went wrong. Try again.");
}

/**
 * The website: requests go through its API routes. Without `ownKey` they use the visitor's free trial on
 * the site's key; with it, the visitor's key travels with each request (never stored on the server).
 */
export function serverBackend(ownKey?: string): Backend {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ownKey) headers["x-gemini-key"] = ownKey;
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const postJson = async (url: string, body: unknown) => {
    const res = await post(url, body);
    return res.ok ? res.json() : fail(res);
  };

  return {
    // The server opens the upload; the PDF itself goes straight from the browser to Google.
    async upload(file) {
      const { uploadUrl } = await postJson("/api/upload", { action: "start", name: file.name, size: file.size, mimeType: file.type });
      try {
        await fetch(uploadUrl, {
          method: "POST",
          headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
          body: file.slice(0, file.size, ""), // the type was already declared at "start"
        });
      } catch {
        // Google's success reply has no CORS header, so the browser reports an error even when the
        // upload worked. The server checks what actually arrived.
      }
      return postJson("/api/upload", { action: "finish", uploadUrl });
    },
    ask: (args) => postJson("/api/ask", args),
    async speak(args) {
      const res = await post("/api/speak", args);
      return res.ok ? res.arrayBuffer() : fail(res);
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function friendly<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}

/** Calls Gemini straight from the browser with the visitor's own key (used by the extension). */
export function directBackend(apiKey: string): Backend {
  const ai = new GoogleGenAI({ apiKey });
  const timeout = () => ({ signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return {
    upload: (file) =>
      friendly(async () => {
        let uploaded = await ai.files.upload({ file, config: { mimeType: "application/pdf", displayName: file.name } });
        const deadline = Date.now() + 90_000;
        while (uploaded.state === "PROCESSING" && Date.now() < deadline) {
          await sleep(2000);
          uploaded = await ai.files.get({ name: uploaded.name! });
        }
        if (uploaded.state === "FAILED") throw new Error("Gemini could not read that PDF.");
        if (uploaded.state !== "ACTIVE") throw new Error("Gemini is still reading that PDF. Try again in a moment.");
        return { uri: uploaded.uri!, mimeType: uploaded.mimeType || "application/pdf" };
      }),
    ask: (args) =>
      friendly(async () => {
        const interaction = await ai.interactions.create(askRequest(args, DEFAULT_TEXT_MODEL), timeout());
        const text = interaction.output_text?.trim();
        if (!text) throw new Error("The host had nothing to say. Try asking again.");
        return { text, id: interaction.id! };
      }),
    speak: (args) =>
      friendly(async () => {
        const interaction = await ai.interactions.create(speakRequest(args, DEFAULT_TTS_MODEL), timeout());
        const wav = audioToWav(interaction.output_audio ?? {});
        return wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
      }),
  };
}

/** Cheap check that a pasted key works, before saving it. */
export async function checkKey(apiKey: string) {
  await friendly(() => new GoogleGenAI({ apiKey }).models.get({ model: DEFAULT_TEXT_MODEL }));
}
