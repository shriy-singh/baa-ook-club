"use client";

import Studio from "@/components/Studio";
import { serverBackend } from "@/lib/backend";

export default function Page() {
  return <Studio backend={serverBackend} />;
}
