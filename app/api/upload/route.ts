import { MISSING_KEY, errorMessage, gemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 50 * 1024 * 1024; // Gemini's PDF limit

const UPLOAD_URL_PREFIX = "https://generativelanguage.googleapis.com/upload/v1beta/files?";

type Body =
  | { action: "start"; name: string; size: number; mimeType: string }
  | { action: "finish"; uploadUrl: string };

// Books go to the Gemini Files API (kept 48 hours) in two steps, so big PDFs never pass through this
// server (Vercel caps request bodies at about 4.5 MB):
//   "start"  opens a resumable upload with our key and returns only the one-time upload URL;
//            the browser then sends the PDF straight to Google.
//   "finish" asks Google about that upload (the browser can't read Google's success reply because it
//            has no CORS header), then waits until Gemini has processed the file.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (body.action === "start") {
      if (body.mimeType !== "application/pdf") return Response.json({ error: "Please upload a PDF." }, { status: 400 });
      if (!(body.size > 0) || body.size > MAX_PDF_BYTES) {
        return Response.json({ error: "That PDF is too big. Gemini reads PDFs up to 50 MB." }, { status: 413 });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error(MISSING_KEY);
      const res = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(body.size),
          "X-Goog-Upload-Header-Content-Type": "application/pdf",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: body.name.slice(0, 120) } }),
      });
      const uploadUrl = res.headers.get("x-goog-upload-url");
      if (!res.ok || !uploadUrl) throw Object.assign(new Error(`Gemini refused the upload (${res.status}).`), { status: res.status });
      return Response.json({ uploadUrl });
    }

    if (body.action === "finish") {
      if (typeof body.uploadUrl !== "string" || !body.uploadUrl.startsWith(UPLOAD_URL_PREFIX)) {
        return Response.json({ error: "Unknown upload." }, { status: 400 });
      }
      const query = await fetch(body.uploadUrl, { method: "POST", headers: { "X-Goog-Upload-Command": "query" } });
      const done = query.headers.get("x-goog-upload-status") === "final";
      const name = done ? ((await query.json()) as { file?: { name?: string } }).file?.name : undefined;
      if (!name) return Response.json({ error: "The book didn't finish uploading. Check your connection and try again." }, { status: 502 });

      const ai = gemini();
      let file = await ai.files.get({ name });
      const deadline = Date.now() + 50_000;
      while (file.state === "PROCESSING" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        file = await ai.files.get({ name });
      }
      if (file.state === "FAILED") return Response.json({ error: "Gemini could not read that PDF." }, { status: 422 });
      if (file.state !== "ACTIVE") return Response.json({ error: "Gemini is still reading that PDF. Try again in a moment." }, { status: 503 });
      return Response.json({ uri: file.uri, mimeType: file.mimeType });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
