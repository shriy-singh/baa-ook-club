"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import KeySetup, { type KeyStore } from "@/components/KeySetup";
import Studio from "@/components/Studio";
import { serverBackend, type NeedKeyError } from "@/lib/backend";

type Trial = { paidOnlyRegion: boolean; freeBooks: number; booksLeft: number; country: string | null };

// The visitor's own key lives in this browser only; it's sent with each request and never stored on the server.
const STORAGE_KEY = "geminiApiKey";
const readKey = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};
const store: KeyStore = {
  save: async (k) => localStorage.setItem(STORAGE_KEY, k),
  forget: async () => localStorage.removeItem(STORAGE_KEY),
};
const NOTE = (
  <>
    Your key is kept only in this browser. It's sent to this site's server with each request, which passes it straight
    to Google and never stores or logs it. <a href="/your-data">See what this site knows about you</a>.
  </>
);

const REASONS: Record<NeedKeyError["reason"], string> = {
  region: "In your region, Gemini's rules don't allow free shared keys for public sites, so the club needs your own free key.",
  books: "You've used your 3 free books this month.",
  asks: "That's all the free questions for this book.",
};

export default function Page() {
  const [ownKey, setOwnKey] = useState<string | null>(null); // null until read from the browser
  const [trial, setTrial] = useState<Trial | null>(null);
  const [keyScreen, setKeyScreen] = useState<NeedKeyError["reason"] | "change" | null>(null);

  const refreshTrial = useCallback(() => {
    fetch("/api/trial")
      .then((r) => r.json())
      .then(setTrial)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOwnKey(readKey());
    refreshTrial();
  }, [refreshTrial]);

  const backend = useMemo(() => serverBackend(ownKey || undefined), [ownKey]);

  if (ownKey === null || !trial) return null;

  // No trial in paid-only regions: start with the key screen.
  const mustBringKey = !ownKey && trial.paidOnlyRegion;
  const screen = keyScreen ?? (mustBringKey ? "region" : null);

  if (screen) {
    return (
      <KeySetup
        store={store}
        note={NOTE}
        hasKey={!!ownKey}
        reason={screen === "change" ? undefined : REASONS[screen]}
        onSaved={(k) => {
          setOwnKey(k);
          setKeyScreen(null);
        }}
        onCancel={mustBringKey ? undefined : () => setKeyScreen(null)}
        cancelLabel={ownKey ? "Back to the club" : "Not now"}
        onForgotten={() => {
          setOwnKey("");
          setKeyScreen(null);
          refreshTrial();
        }}
      />
    );
  }

  const notice = (
    <p className="trial-note">
      {ownKey ? (
        <>Using your own Gemini key.</>
      ) : (
        <>
          {trial.booksLeft} of {trial.freeBooks} free books left this month.
          <button className="swap" onClick={() => setKeyScreen("change")}>
            Use your own key
          </button>
        </>
      )}{" "}
      <a className="data-link" href="/your-data">
        What this site knows about you
      </a>
    </p>
  );

  return (
    <Studio
      backend={backend}
      onChangeKey={ownKey ? () => setKeyScreen("change") : undefined}
      onNeedKey={(err) => {
        refreshTrial();
        setKeyScreen(err.reason);
      }}
      onBookLoaded={refreshTrial}
      notice={notice}
    />
  );
}
