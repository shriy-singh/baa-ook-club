import { askRequest, type AskArgs } from "@/lib/hosting";
import { REQUEST_TIMEOUT_MS, TEXT_MODEL, errorMessage, gemini } from "@/lib/gemini";
import { ASKS_PER_BOOK, countryOf, fileName, needKey, ownKey, paidOnlyRegion, readTrial, withTrial } from "@/lib/trial";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const args = (await req.json()) as AskArgs;
    if (!args.fileUri) return Response.json({ error: "Upload a book first." }, { status: 400 });

    const own = ownKey(req);
    const trial = readTrial(req);
    if (!own) {
      if (paidOnlyRegion(countryOf(req))) return needKey("region");
      // Free questions only about this browser's current free book.
      if (!trial.f || trial.f !== fileName(args.fileUri)) return needKey("books");
      if (trial.q >= ASKS_PER_BOOK) return needKey("asks");
    }

    const interaction = await gemini(own ?? undefined).interactions.create(askRequest(args, TEXT_MODEL), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const answer = interaction.output_text?.trim();
    if (!answer) return Response.json({ error: "The host had nothing to say. Try asking again." }, { status: 502 });
    const res = Response.json({ text: answer, id: interaction.id });
    return own ? res : withTrial(res, { ...trial, q: trial.q + 1 });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
