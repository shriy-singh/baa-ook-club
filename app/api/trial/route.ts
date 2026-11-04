import { ASKS_PER_BOOK, FREE_BOOKS, TRIAL_COOKIE, countryOf, paidOnlyRegion, readTrial, readTrialCookie } from "@/lib/trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What the page needs to know about this browser's free trial, plus the raw facts the
// "What this site knows about you" page shows. Nothing here is stored.
export function GET(req: Request) {
  const country = countryOf(req);
  const trial = readTrial(req);
  const hasCookie = readTrialCookie(req) !== null; // only a genuine, correctly signed cookie
  return Response.json(
    {
      country,
      paidOnlyRegion: paidOnlyRegion(country),
      freeBooks: FREE_BOOKS,
      booksLeft: Math.max(0, FREE_BOOKS - trial.n),
      asksPerBook: ASKS_PER_BOOK,
      cookie: hasCookie ? { name: TRIAL_COOKIE, month: trial.m, booksUsed: trial.n, questionsOnCurrentBook: trial.q } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
