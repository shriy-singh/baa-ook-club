import { getCharacter } from "@/lib/characters";
import { INTRO_REQUEST, REQUEST_TIMEOUT_MS, TEXT_MODEL, errorMessage, gemini, hostPrompt } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type AskBody = { fileUri: string; mimeType?: string; question?: string; previousId?: string; host?: string };

// The first call sends the book itself; follow-ups chain on previous_interaction_id so Gemini keeps the conversation.
export async function POST(req: Request) {
  try {
    const { fileUri, mimeType, question, previousId, host } = (await req.json()) as AskBody;
    if (!fileUri) return Response.json({ error: "Upload a book first." }, { status: 400 });

    const text = question?.trim() || INTRO_REQUEST;
    const input = previousId
      ? [{ type: "text" as const, text }]
      : [
          { type: "document" as const, uri: fileUri, mime_type: (mimeType || "application/pdf") as "application/pdf" },
          { type: "text" as const, text },
        ];

    const interaction = await gemini().interactions.create({
      model: TEXT_MODEL,
      system_instruction: hostPrompt(getCharacter(host)),
      input,
      previous_interaction_id: previousId,
    }, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    const answer = interaction.output_text?.trim();
    if (!answer) return Response.json({ error: "The host had nothing to say. Try asking again." }, { status: 502 });
    return Response.json({ text: answer, id: interaction.id });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
