import { errorMessage, gemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Uploads the book to the Gemini Files API (kept there for 48 hours) so every question can reference it.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return Response.json({ error: "No PDF received." }, { status: 400 });
    if (file.type !== "application/pdf") return Response.json({ error: "Please upload a PDF." }, { status: 400 });

    const ai = gemini();
    let uploaded = await ai.files.upload({ file, config: { mimeType: "application/pdf" } });
    while (uploaded.state === "PROCESSING") {
      await new Promise((r) => setTimeout(r, 2000));
      uploaded = await ai.files.get({ name: uploaded.name! });
    }
    if (uploaded.state === "FAILED") return Response.json({ error: "Gemini could not read that PDF." }, { status: 422 });

    return Response.json({ uri: uploaded.uri, mimeType: uploaded.mimeType });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
