import { errorMessage, gemini, siteKey } from "@/lib/gemini";
import { FREE_BOOKS, countryOf, needKey, ownKey, paidOnlyRegion, readTrial, withTrial } from "@/lib/trial";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 50 * 1024 * 1024; // Gemini's PDF limit

const UPLOAD_URL_PREFIX = "https://generativelanguage.googleapis.com/upload/v1beta/files?";

type Body =
  | { action: "start"; name: string; size: number; mimeType: string }
  | { action: "finish"; uploadUrl: string };

// Books go to the Gemini Files API (kept 48 hours) in two steps, so big PDFs never pass through this
// server (Vercel caps request bodies at about 4.5 MB):
//   "start"  opens a resumable upload and returns only the one-time upload URL;
//            the browser then sends the PDF straight to Google.
//   "finish" asks Google about that upload (the browser can't read Google's success reply because it
//            has no CORS header), then waits until Gemini has processed the file.
// Visitors with their own key use it; everyone else uses one of their free books on the site's key.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const own = ownKey(req);
    const trial = readTrial(req);
    if (!own) {
      if (paidOnlyRegion(countryOf(req))) return needKey("region");
      if (body.action === "start" && trial.n >= FREE_BOOKS) return needKey("books");
    }

    if (body.action === "start") {
      if (body.mimeType !== "application/pdf") return Response.json({ error: "Please upload a PDF." }, { status: 400 });
      if (!(body.size > 0) || body.size > MAX_PDF_BYTES) {
        return Response.json({ error: "That PDF is too big. Gemini reads PDFs up to 50 MB." }, { status: 413 });
      }
      const res = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
        method: "POST",
        headers: {
          "x-goog-api-key": own ?? siteKey(),
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

      const ai = gemini(own ?? undefined);
      let file = await ai.files.get({ name });
      const deadline = Date.now() + 50_000;
      while (file.state === "PROCESSING" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        file = await ai.files.get({ name });
      }
      if (file.state === "FAILED") return Response.json({ error: "Gemini could not read that PDF." }, { status: 422 });
      if (file.state !== "ACTIVE") return Response.json({ error: "Gemini is still reading that PDF. Try again in a moment." }, { status: 503 });

      const res = Response.json({ uri: file.uri, mimeType: file.mimeType });
      // A free book is counted once it's ready, and becomes the one book this browser can chat about.
      return own ? res : withTrial(res, { ...trial, n: trial.n + 1, f: name, q: 0, s: 0 });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}
