// How the Studio talks to Gemini. The web app goes through its own API routes (the deployment's key
// stays on the server); the browser extension calls Gemini directly with the visitor's own key.
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

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export const serverBackend: Backend = {
  // The server opens the upload with its key; the PDF itself goes straight from the browser to Google.
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
    const res = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
    if (!res.ok) throw new Error((await res.json()).error || "The voice did not come through.");
    return res.arrayBuffer();
  },
};

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
