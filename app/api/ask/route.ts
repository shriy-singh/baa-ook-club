import { askRequest, type AskArgs } from "@/lib/hosting";
import { REQUEST_TIMEOUT_MS, TEXT_MODEL, errorMessage, gemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const args = (await req.json()) as AskArgs;
    if (!args.fileUri) return Response.json({ error: "Upload a book first." }, { status: 400 });

    const interaction = await gemini().interactions.create(askRequest(args, TEXT_MODEL), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const answer = interaction.output_text?.trim();
    if (!answer) return Response.json({ error: "The host had nothing to say. Try asking again." }, { status: 502 });
    return Response.json({ text: answer, id: interaction.id });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
