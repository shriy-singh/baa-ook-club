import { useState } from "react";
import { checkKey } from "@/lib/backend";
import { ensureGeminiAccess, forgetKey, saveKey } from "./keyStore";

type Props = {
  hasKey: boolean;
  onSaved: (key: string) => void;
  onCancel?: () => void;
  onForgotten: () => void;
};

// First-run screen: each person brings their own free Gemini key, so nobody shares a quota.
export default function KeySetup({ hasKey, onSaved, onCancel, onForgotten }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    setError("");
    setBusy(true);
    try {
      // Ask for access first: Firefox only allows the prompt directly inside the click.
      if (!(await ensureGeminiAccess())) throw new Error("Baa-ook Club needs permission to talk to Gemini to work.");
      await checkKey(key);
      await saveKey(key);
      onSaved(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    await forgetKey();
    onForgotten();
  };

  return (
    <main className="key-room">
      <section className="key-card">
        <img src="/icons/icon-128.png" alt="" width={84} height={84} />
        <h1>Baa-ook Club</h1>
        <p className="key-lede">
          Hand a book to Woolf and friends, and talk it through out loud. The hosts think and speak with Google's Gemini,
          using <strong>your own free API key</strong>.
        </p>

        <ol className="key-steps">
          <li>
            Get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>{" "}
            (sign in with Google, then "Create API key").
          </li>
          <li>Paste it below.</li>
        </ol>

        <form onSubmit={save} className="key-form">
          <label htmlFor="gemini-key">Your Gemini API key</label>
          <input
            id="gemini-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="send" disabled={busy || !value.trim()}>
            {busy ? "Checking…" : "Save key"}
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}

        <p className="key-note">
          Your key is stored only in this browser and is only ever sent to Google. Books you upload go to Gemini, which
          keeps them for 48 hours. On the free tier Google may use what you send to improve its products, so don't upload
          anything sensitive. Gemini requires users to be 18 or older.{" "}
          <a href="https://shriy-singh.github.io/baa-ook-club/privacy.html" target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>

        {hasKey && (
          <div className="key-actions">
            {onCancel && <button className="swap" onClick={onCancel}>Back to the club</button>}
            <button className="swap" onClick={forget}>Forget my key</button>
          </div>
        )}
      </section>
    </main>
  );
}
