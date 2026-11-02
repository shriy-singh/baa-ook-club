import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Studio from "@/components/Studio";
import { directBackend } from "@/lib/backend";
import KeySetup from "./KeySetup";
import { loadKey } from "./keyStore";
import "@fontsource/bowlby-one/400.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@/app/globals.css";
import "./extension.css";

function App() {
  const [key, setKey] = useState<string | null>(null); // null while loading
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    loadKey().then(setKey);
  }, []);
  const backend = useMemo(() => (key ? directBackend(key) : null), [key]);

  if (key === null) return null;
  if (!backend || editing) {
    return (
      <KeySetup
        hasKey={!!key}
        onSaved={(k) => {
          setKey(k);
          setEditing(false);
        }}
        onCancel={key ? () => setEditing(false) : undefined}
        onForgotten={() => {
          setKey("");
          setEditing(false);
        }}
      />
    );
  }
  return <Studio backend={backend} onChangeKey={() => setEditing(true)} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
