"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Avatar, { type AvatarMode, type Reaction } from "@/components/Avatar";
import type { Backend } from "@/lib/backend";
import { CHARACTERS, DEFAULT_CHARACTER, INK, PAPER, VOICES, getCharacter, mix, type CharacterId } from "@/lib/characters";

type Line = { who: "you" | "host"; host?: CharacterId; text: string };
type Book = { name: string; uri: string; mimeType: string };

function splitFirstSentence(text: string) {
  const match = text.match(/^(.{20,}?[.!?])\s+(.+)$/s);
  return match ? [match[1], match[2]] : [text];
}

// Chrome and Edge ship speech recognition under a prefixed name.
function getRecognition(): any {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SR ? new SR() : null;
}

type Props = {
  backend: Backend;
  /** Shown in the extension, where each person brings their own Gemini key. */
  onChangeKey?: () => void;
};

// The whole Baa-ook Club screen, shared by the web app and the browser extension.
export default function Studio({ backend, onChangeKey }: Props) {
  const [hostId, setHostId] = useState<CharacterId>(DEFAULT_CHARACTER);
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<"empty" | "reading" | "ready">("empty");
  const [mode, setMode] = useState<AvatarMode>("idle");
  const [reaction, setReaction] = useState<Reaction>();
  const [lines, setLines] = useState<Line[]>([]);
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState(""); // "" = each host's own voice
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const host = getCharacter(hostId);
  const previousId = useRef<string | undefined>(undefined);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const recognition = useRef<any>(null);
  const samples = useRef(new Float32Array(1024));
  const transcriptRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    setCanListen(!!getRecognition());
  }, []);
  // The whole room takes on the current host's colour, including the area behind the layout.
  useEffect(() => {
    document.body.style.setProperty("--world", host.world);
    document.body.style.setProperty("--shade", mix(host.world, INK, 0.55));
  }, [host.world]);
  useEffect(() => {
    const list = transcriptRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const react = (kind: Reaction["kind"]) => setReaction((r) => ({ kind, n: (r?.n ?? 0) + 1 }));
  const fail = (message: string) => {
    setMode("idle");
    setError(message);
    react("fail");
  };

  // Browsers only allow audio after a click, so this runs inside click handlers.
  const unlockAudio = () => {
    if (!audioCtx.current) {
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.connect(ctx.destination);
      audioCtx.current = ctx;
      analyser.current = node;
    }
    void audioCtx.current.resume();
  };

  const getLevel = useCallback(() => {
    const node = analyser.current;
    if (!node) return 0;
    node.getFloatTimeDomainData(samples.current);
    let sum = 0;
    for (const s of samples.current) sum += s * s;
    return Math.min(1, Math.sqrt(sum / samples.current.length) * 5);
  }, []);

  // Bumped on every stop so a half-played answer can't keep going after Stop or a new question.
  const speechRun = useRef(0);

  const stopSpeaking = () => {
    speechRun.current++;
    if (source.current) {
      source.current.onended = null;
      source.current.stop();
      source.current = null;
    }
    setMode("idle");
  };

  const fetchAudio = async (text: string, speaker: CharacterId) => {
    const wav = await backend.speak({ text, voice: voice || undefined, host: speaker });
    return audioCtx.current!.decodeAudioData(wav);
  };

  const playBuffer = (buffer: AudioBuffer) =>
    new Promise<void>((resolve) => {
      const node = audioCtx.current!.createBufferSource();
      node.buffer = buffer;
      node.connect(analyser.current!);
      node.onended = () => {
        source.current = null;
        resolve();
      };
      source.current = node;
      node.start();
    });

  // The first sentence is voiced on its own so the host starts talking sooner; the rest is generated meanwhile.
  const speak = async (text: string, speaker: CharacterId = hostId) => {
    stopSpeaking();
    const run = speechRun.current;
    setMode("thinking");
    const audio = splitFirstSentence(text).map((part) => fetchAudio(part, speaker));
    audio.forEach((p) => p.catch(() => {})); // errors surface when each part is awaited
    try {
      for (const part of audio) {
        const buffer = await part;
        if (run !== speechRun.current) return;
        setMode("speaking");
        await playBuffer(buffer);
        if (run !== speechRun.current) return;
      }
    } finally {
      if (run === speechRun.current) setMode("idle");
    }
  };

  const ask = async (question: string | undefined, forBook = book) => {
    if (!forBook) return;
    setError("");
    stopSpeaking();
    if (question) setLines((l) => [...l, { who: "you", text: question }]);
    setMode("thinking");
    setCaption("");
    const speaker = hostId;
    try {
      const data = await backend.ask({ fileUri: forBook.uri, mimeType: forBook.mimeType, question, previousId: previousId.current, host: speaker });
      previousId.current = data.id;
      setLines((l) => [...l, { who: "host", host: speaker, text: data.text }]);
      setCaption(data.text);
      try {
        await speak(data.text, speaker);
      } catch (err) {
        fail(`Couldn't play the voice: ${(err as Error).message}`);
      }
    } catch (err) {
      fail((err as Error).message);
    }
  };

  const loadBook = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return fail("That isn't a PDF. The hosts only read PDFs.");
    unlockAudio();
    stopSpeaking();
    setError("");
    setStatus("reading");
    setMode("thinking");
    setLines([]);
    setCaption("");
    previousId.current = undefined;
    try {
      const data = await backend.upload(file);
      const next = { name: file.name, uri: data.uri, mimeType: data.mimeType };
      setBook(next);
      setStatus("ready");
      react("success");
      await ask(undefined, next);
    } catch (err) {
      setStatus(book ? "ready" : "empty");
      fail((err as Error).message);
    }
  };

  const pickHost = (id: CharacterId) => {
    if (id === hostId) return;
    stopSpeaking();
    recognition.current?.abort();
    setHostId(id);
    setCaption("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || mode === "thinking") return;
    unlockAudio();
    setDraft("");
    void ask(q);
  };

  const toggleMic = () => {
    unlockAudio();
    if (listening) return recognition.current?.stop();
    const rec = getRecognition();
    if (!rec) return;
    stopSpeaking();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>).map((r) => r[0].transcript).join(" ");
      setDraft(text);
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setMode((m) => (m === "listening" ? "idle" : m));
      recognition.current = null;
      if (finalText.trim()) {
        setDraft("");
        void ask(finalText.trim());
      }
    };
    recognition.current = rec;
    setListening(true);
    setMode("listening");
    rec.start();
  };

  const onAir = mode === "speaking";
  const busy = mode === "thinking";
  const statusLabel = onAir ? "On air" : busy ? "Thinking" : listening ? "Listening to you" : "Ready";

  return (
    <main className="studio">
      <header className="masthead">
        <div>
          <p className="eyebrow">A cozy book chat, hosted tonight by {host.name}</p>
          <h1>Baa-ook Club</h1>
        </div>
        <div className={`on-air ${onAir ? "live" : ""} ${listening ? "hearing" : ""}`} aria-live="polite">
          <span className="dot" /> {statusLabel}
        </div>
      </header>

      <section className="stage-col">
        <div className="hosts" role="radiogroup" aria-label="Choose your host">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === hostId}
              className={`host ${c.id === hostId ? "on" : ""}`}
              style={{ "--chip": c.world } as React.CSSProperties}
              onClick={() => pickHost(c.id)}
            >
              <img src={`/characters/${c.id}.png`} alt="" width={40} height={40} style={{ background: c.stage }} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className={`stage ${onAir ? "live" : ""}`} style={{ background: host.stage }}>
          <Avatar character={host} mode={mode} getLevel={getLevel} reaction={reaction} />
          {book && <div className="book-chip" title={book.name}><span>Reading</span> {book.name}</div>}
        </div>

        <p className={`caption ${caption ? "" : "muted"}`}>
          {caption ||
            (status === "reading"
              ? `${host.name} is reading your book. Big books take a minute…`
              : busy
                ? "Let me think about that…"
                : listening
                  ? "I'm listening…"
                  : status === "empty"
                    ? `${host.name}: ${host.tagline.toLowerCase()}. Hand them a book and ask anything about it.`
                    : `Ask ${host.name} anything about the book.`)}
        </p>

        {status === "empty" || status === "reading" ? (
          <label
            className={`dropzone ${dragging ? "over" : ""} ${status === "reading" ? "disabled" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void loadBook(e.dataTransfer.files[0]);
            }}
          >
            <input type="file" accept="application/pdf" disabled={status === "reading"} onChange={(e) => void loadBook(e.target.files?.[0])} />
            <strong>{status === "reading" ? "Reading…" : "Drop a book PDF here"}</strong>
            <span>or click to choose a file</span>
          </label>
        ) : (
          <form className="ask" onSubmit={submit}>
            {canListen && (
              <button type="button" className={`mic ${listening ? "on" : ""}`} onClick={toggleMic} disabled={busy} aria-label={listening ? "Stop listening" : "Ask out loud"}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                </svg>
              </button>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask about a character, a chapter, the ending…"}
              disabled={busy}
            />
            {onAir ? (
              <button type="button" className="send" onClick={stopSpeaking}>Stop</button>
            ) : (
              <button type="submit" className="send" disabled={busy || !draft.trim()}>Ask</button>
            )}
          </form>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <aside className="notes">
        <div className="notes-head">
          <h2>Show notes</h2>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice">
            <option value="">Each host's own voice</option>
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        {lines.length === 0 ? (
          <p className="muted small">The conversation will appear here.</p>
        ) : (
          <ol className="transcript" ref={transcriptRef}>
            {lines.map((l, i) => (
              <li
                key={i}
                className={`line-${l.who}`}
                style={l.host ? { background: mix(getCharacter(l.host).world, PAPER, 0.55) } : undefined}
              >
                <span className="who">{l.who === "you" ? "You" : getCharacter(l.host).name}</span>
                <p>{l.text}</p>
                {l.who === "host" && !onAir && !busy && (
                  <button className="replay" onClick={() => { unlockAudio(); void speak(l.text, l.host).catch((e) => setError(e.message)); }}>
                    Replay
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {book && status === "ready" && (
          <label className="swap">
            <input type="file" accept="application/pdf" onChange={(e) => void loadBook(e.target.files?.[0])} />
            Swap book
          </label>
        )}
        {onChangeKey && (
          <button className="swap" onClick={onChangeKey}>
            Change Gemini key
          </button>
        )}
        <p className="credits">
          Characters from the Rive community, CC BY 4.0:{" "}
          {CHARACTERS.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <a href={c.credit.url} target="_blank" rel="noreferrer">{c.name}</a> by {c.credit.author}
            </span>
          ))}
        </p>
      </aside>
    </main>
  );
}
