import { audioToWav, speakRequest, type SpeakArgs } from "@/lib/hosting";
import { REQUEST_TIMEOUT_MS, TTS_MODEL, errorMessage, gemini } from "@/lib/gemini";
import { SPEAKS_PER_BOOK, countryOf, needKey, ownKey, paidOnlyRegion, readTrial, withTrial } from "@/lib/trial";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns the host's answer into speech in their voice and returns a WAV file.
export async function POST(req: Request) {
  try {
    const args = (await req.json()) as SpeakArgs;
    if (!args.text?.trim()) return Response.json({ error: "Nothing to say." }, { status: 400 });

    const own = ownKey(req);
    const trial = readTrial(req);
    if (!own) {
      if (paidOnlyRegion(countryOf(req))) return needKey("region");
      if (!trial.f) return needKey("books");
      if (trial.s >= SPEAKS_PER_BOOK) return needKey("asks");
    }

    const interaction = await gemini(own ?? undefined).interactions.create(speakRequest(args, TTS_MODEL), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const audio = interaction.output_audio;
    if (!audio?.data) return Response.json({ error: "No audio came back from Gemini." }, { status: 502 });

    const res = new Response(audioToWav(audio) as BodyInit, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
    return own ? res : withTrial(res, { ...trial, s: trial.s + 1 });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
