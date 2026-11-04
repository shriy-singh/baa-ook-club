"use client";

import { useEffect, useState } from "react";

type Row = [label: string, value: string, why: string];
type TrialInfo = {
  country: string | null;
  paidOnlyRegion: boolean;
  cookie: { name: string; month: string; booksUsed: number; questionsOnCurrentBook: number } | null;
};

function browserAndOs(ua: string) {
  const browser =
    (/Edg\//.test(ua) && "Edge") || (/OPR\//.test(ua) && "Opera") || (/Firefox\//.test(ua) && "Firefox") ||
    (/Chrome\//.test(ua) && "Chrome") || (/Safari\//.test(ua) && "Safari") || "Unknown browser";
  const os =
    (/Windows/.test(ua) && "Windows") || (/Android/.test(ua) && "Android") || (/iPhone|iPad/.test(ua) && "iOS") ||
    (/Mac OS X/.test(ua) && "macOS") || (/Linux/.test(ua) && "Linux") || "unknown system";
  return `${browser} on ${os}`;
}

function countryName(code: string | null) {
  if (!code) return "Not available here (only shown on the live site)";
  try {
    return `${new Intl.DisplayNames(["en"], { type: "region" }).of(code)} (${code})`;
  } catch {
    return code;
  }
}

// Everything on this page is read live from your own browser and shown back to you. None of it is saved.
export default function DataReport() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [ownKey, setOwnKey] = useState<string>("");

  useEffect(() => {
    const n = navigator as Navigator & { deviceMemory?: number; globalPrivacyControl?: boolean };
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRows([
      ["Browser and system", browserAndOs(n.userAgent), "Sent with every request as the User-Agent."],
      ["Languages", (n.languages ?? [n.language]).join(", "), "Sent with every request so sites can pick a language."],
      ["Time zone", tz, "Any page's JavaScript can read it."],
      ["Screen", `${screen.width} × ${screen.height}, window ${innerWidth} × ${innerHeight}, pixel ratio ${devicePixelRatio}`, "Any page can read it; often used to fingerprint browsers."],
      ["Processor cores", String(n.hardwareConcurrency ?? "hidden"), "Readable by any page."],
      ["Memory", n.deviceMemory ? `about ${n.deviceMemory} GB` : "hidden by your browser", "Readable in Chromium browsers."],
      ["Touch screen", n.maxTouchPoints > 0 ? "yes" : "no", "Readable by any page."],
      ["Dark mode preference", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", "Readable by any page."],
      ["Came from", document.referrer || "typed or bookmarked (no referrer)", "Sent when you follow a link here."],
      ["Do Not Track / Global Privacy Control", `${n.doNotTrack === "1" ? "DNT on" : "DNT off"}, ${n.globalPrivacyControl ? "GPC on" : "GPC off"}`, "Signals you can turn on; we collect nothing either way."],
    ]);
    try {
      setOwnKey(localStorage.getItem("geminiApiKey") ?? "");
    } catch {}
    fetch("/api/trial")
      .then((r) => r.json())
      .then(setTrial)
      .catch(() => {});
  }, []);

  return (
    <main className="data-page">
      <a href="/" className="data-back">← Back to the club</a>
      <h1>What this site knows about you</h1>
      <p className="data-lede">
        Even a small site like this one gets a surprising amount of information from your browser, just because you
        visited. Here is what Baa-ook Club can see right now, what it actually keeps, and where your book goes. Everything
        on this page was read live from your browser and is not saved anywhere.
      </p>

      <section className="data-card">
        <h2>What your browser tells every site</h2>
        <p className="muted small">These are your real values, read just now. Baa-ook Club doesn't store or send any of them.</p>
        <table className="data-table">
          <tbody>
            <tr>
              <th>Country</th>
              <td>{countryName(trial?.country ?? null)}</td>
              <td className="muted">Worked out from your IP address by our host, Vercel, on each request. Used only to decide whether the free trial is allowed where you are.</td>
            </tr>
            {(rows ?? []).map(([label, value, why]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{value}</td>
                <td className="muted">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="data-card">
        <h2>What Baa-ook Club keeps</h2>
        <ul>
          <li>
            <strong>One cookie, <code>bc_trial</code></strong>, to count your free books.{" "}
            {trial?.cookie
              ? `Right now it says: ${trial.cookie.month}, ${trial.cookie.booksUsed} of 3 free books used, ${trial.cookie.questionsOnCurrentBook} questions on the current book.`
              : "You don't have it yet; it's set when you upload your first free book."}{" "}
            It's signed so it can't be edited, holds no name or ID, and resets each month.
          </li>
          <li>
            <strong>Your own Gemini key, if you added one</strong>, in this browser's local storage:{" "}
            {ownKey ? `yes (ending in …${ownKey.slice(-4)}).` : "none saved."} It's sent with each request so our server
            can pass it to Google; the server never stores or logs it.
          </li>
          <li>
            <strong>Hosting logs.</strong> Like every website, our host Vercel keeps short-lived technical logs of
            requests (time, page, IP address). We don't add anything to them or use them to track you.
          </li>
        </ul>
      </section>

      <section className="data-card">
        <h2>What goes to Google</h2>
        <p>
          To read your book and answer you, the book (PDF), your questions and the answers go to Google's Gemini API.
          Google keeps uploaded books for 48 hours. On Gemini's free tier, Google may use what you send to improve its
          products and human reviewers may read it, so please don't upload anything sensitive or personal.
        </p>
        <p>
          If you use the mic, your browser's own speech recognition turns your voice into text (in Chrome and Edge that's
          processed by the browser maker). Only the text reaches Baa-ook Club.
        </p>
      </section>

      <section className="data-card">
        <h2>What we never do</h2>
        <ul>
          <li>No accounts or sign-ups.</li>
          <li>No analytics, tracking pixels, ads or fingerprinting.</li>
          <li>No storing of your books, questions or key on our servers.</li>
          <li>No selling or sharing of anything, with anyone other than Google as described above.</li>
        </ul>
        <p className="muted small">
          Full details in the <a href="https://shriy-singh.github.io/baa-ook-club/privacy.html">privacy policy</a>. The
          code is open source on <a href="https://github.com/shriy-singh/baa-ook-club">GitHub</a>, so you can check all of
          this yourself.
        </p>
      </section>
    </main>
  );
}
