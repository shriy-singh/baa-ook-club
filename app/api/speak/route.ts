import { VOICES, getCharacter } from "@/lib/characters";
import { REQUEST_TIMEOUT_MS, TTS_MODEL, errorMessage, gemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns the host's answer into speech in their voice and returns a WAV file.
export async function POST(req: Request) {
  try {
    const { text, voice, host: hostId } = (await req.json()) as { text: string; voice?: string; host?: string };
    if (!text?.trim()) return Response.json({ error: "Nothing to say." }, { status: 400 });
    const host = getCharacter(hostId);
    // An explicit pick from the voice menu wins; otherwise each host has their own voice.
    const chosen = VOICES.some((v) => v.id === voice) ? voice! : host.voice;

    const interaction = await gemini().interactions.create({
      model: TTS_MODEL,
      input: [
        {
          type: "user_input",
          content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: host.voiceStyle }] }],
        },
      ],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: chosen }] },
      stream: false,
    }, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    const audio = interaction.output_audio;
    if (!audio?.data) return Response.json({ error: "No audio came back from Gemini." }, { status: 502 });

    let bytes: Uint8Array = Buffer.from(audio.data, "base64");
    const mime = String(audio.mime_type || "audio/wav");
    // Raw PCM (audio/l16) has no header, so wrap it to make it playable in the browser.
    if (!mime.includes("wav")) bytes = pcmToWav(bytes, audio.sample_rate || 24000);

    return new Response(bytes as BodyInit, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}

function pcmToWav(pcm: Uint8Array, sampleRate: number) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return new Uint8Array(Buffer.concat([header, pcm]));
}
