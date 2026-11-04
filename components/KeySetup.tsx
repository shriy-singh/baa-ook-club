"use client";

import { useState, type ReactNode } from "react";
import { checkKey } from "@/lib/backend";

export type KeyStore = {
  save(key: string): Promise<void>;
  forget(): Promise<void>;
  /** Runs inside the Save click, e.g. to ask the browser for permission to reach Gemini. */
  beforeSave?(): Promise<boolean>;
};

type Props = {
  store: KeyStore;
  hasKey: boolean;
  onSaved: (key: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  onForgotten: () => void;
  /** Why the key is needed right now (website: trial used up, or region). */
  reason?: string;
  /** Where the key is kept and where it goes. */
  note: ReactNode;
};

// "Bring your own key" screen, shared by the website and the extension.
export default function KeySetup({ store, hasKey, onSaved, onCancel, cancelLabel = "Back to the club", onForgotten, reason, note }: Props) {
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
      if (store.beforeSave && !(await store.beforeSave())) throw new Error("Baa-ook Club needs permission to talk to Gemini to work.");
      await checkKey(key);
      await store.save(key);
      onSaved(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    await store.forget();
    onForgotten();
  };

  return (
    <main className="key-room">
      <section className="key-card">
        <img src="/icons/icon-192.png" alt="" width={84} height={84} />
        <h1>Baa-ook Club</h1>
        {reason && <p className="key-reason">{reason}</p>}
        <p className="key-lede">
          The hosts think and speak with Google's Gemini. With <strong>your own free API key</strong>, you can keep
          chatting about as many books as Gemini's free tier allows.
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
          {note} On the free tier Google may use what you send to improve its products, so don't upload anything
          sensitive. Gemini requires users to be 18 or older.{" "}
          <a href="https://shriy-singh.github.io/baa-ook-club/privacy.html" target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>

        <div className="key-actions">
          {onCancel && <button className="swap" onClick={onCancel}>{cancelLabel}</button>}
          {hasKey && <button className="swap" onClick={forget}>Forget my key</button>}
        </div>
      </section>
    </main>
  );
}
