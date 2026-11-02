"use client";

import { useEffect, useRef } from "react";
import { Fit, Layout, Rive, RuntimeLoader, type RiveParameters } from "@rive-app/canvas";
import type { Character, CharacterId, Crop } from "@/lib/characters";

export type AvatarMode = "idle" | "listening" | "thinking" | "speaking";
export type Reaction = { kind: "success" | "fail"; n: number };

type Frame = { mode: AvatarMode; level: number; dt: number; t: number; canvas: HTMLCanvasElement };

// A driver turns "what the host is doing" into whatever controls that particular .riv file has.
type Driver = {
  options: Partial<RiveParameters>;
  onLoad(rive: Rive): void;
  tick(rive: Rive, frame: Frame): void;
  react?(rive: Rive, kind: Reaction["kind"]): void;
};

// Some community files only have timeline animations, which the runtime still supports by name.
(Rive as unknown as { suppressDeprecationWarnings: string[] }).suppressDeprecationWarnings = [
  "scrub", "animation-names", "animations-param",
];

function input(rive: Rive, name: string) {
  return rive.stateMachineInputs("State Machine 1")?.find((i) => i.name === name);
}

const DRIVERS: Record<CharacterId, () => Driver> = {
  // Sheep: no inputs at all. Its grass-chewing loop doubles as the talking mouth, moved forward by voice loudness.
  woolf: () => {
    let phase = 0;
    let earTimer = 3;
    let blinkTimer = 2;
    let wasListening = false;
    return {
      options: { artboard: "sunum", animations: ["nefes +", "goz", "gevis"] },
      onLoad: (rive) => rive.pause("gevis"),
      tick(rive, { mode, level, dt }) {
        if (mode === "speaking") {
          if (level > 0.04) phase += dt * (1.1 + level * 3.5);
          else phase += (Math.round(phase) - phase) * Math.min(1, dt * 12); // pause between words: mouth closed
        } else if (mode === "listening") {
          phase += (Math.round(phase) - phase) * Math.min(1, dt * 6); // stops chewing to listen
        } else {
          phase += dt * (mode === "thinking" ? 1.15 : 0.6); // chews its grass; faster while thinking
        }
        rive.scrub("gevis", phase % 1);

        blinkTimer -= dt;
        earTimer -= dt;
        if (blinkTimer <= 0) {
          rive.stop("kirp");
          rive.play("kirp");
          blinkTimer = 2.5 + Math.random() * 3.5;
        }
        const startedListening = mode === "listening" && !wasListening;
        wasListening = mode === "listening";
        if (earTimer <= 0 || startedListening) {
          const ear = Math.random() < 0.5 ? "kulak" : "kulak 2";
          rive.stop(ear);
          rive.play(ear);
          earTimer = 5 + Math.random() * 7;
        }
      },
    };
  },

  // Yeti: a state machine with Hear and Talk switches, plus success/fail reactions.
  frost: () => {
    let quietFor = 0;
    return {
      options: { stateMachines: "State Machine 1" },
      onLoad: () => {},
      tick(rive, { mode, level, dt }) {
        quietFor = level > 0.03 ? 0 : quietFor + dt;
        const talk = input(rive, "Talk");
        const hear = input(rive, "Hear");
        // Hold the mouth open through short gaps so it doesn't flicker between syllables.
        if (talk) talk.value = mode === "speaking" && quietFor < 0.25;
        if (hear) hear.value = mode === "listening";
      },
      react(rive, kind) {
        input(rive, kind)?.fire();
      },
    };
  },

  // Storyteller: a 10-frame talking loop, scrubbed like the sheep's chew; eyebrows move only while he talks.
  silas: () => {
    let phase = 0;
    let browsOn = false;
    return {
      options: { artboard: "Character ", animations: ["Eyelids", "Talking", "Eybrows"] },
      onLoad(rive) {
        rive.pause(["Talking", "Eybrows"]);
      },
      tick(rive, { mode, level, dt }) {
        if (mode === "speaking" && level > 0.04) phase += dt * (2.2 + level * 4);
        else phase += (Math.round(phase) - phase) * Math.min(1, dt * 14);
        rive.scrub("Talking", (phase % 1) * (10 / 60));
        const wantBrows = mode === "speaking" || mode === "thinking";
        if (wantBrows !== browsOn) {
          browsOn = wantBrows;
          if (browsOn) rive.play("Eybrows");
          else rive.pause("Eybrows");
        }
      },
    };
  },

  // Pixel blob: a view model with isTalking and mouthWidth/mouthHeight, so the mouth follows loudness directly.
  // Its head follows the mouse through the file's own listeners, so we steer its gaze with pointer events.
  pip: () => {
    let mouth = 0;
    let steering = false;
    const lookAt = (canvas: HTMLCanvasElement, fx: number, fy: number) => {
      const r = canvas.getBoundingClientRect();
      const at = { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles: true };
      canvas.dispatchEvent(new PointerEvent("pointermove", { ...at, pointerType: "mouse" }));
      canvas.dispatchEvent(new MouseEvent("mousemove", at));
    };
    return {
      options: { artboard: "AvatarCreationUI", stateMachines: "State Machine 1", autoBind: true },
      onLoad(rive) {
        const vm = rive.viewModelInstance;
        if (!vm) return;
        vm.number("hairSelect")!.value = 3;
        vm.number("earSelect")!.value = 1;
        vm.number("eyeSelect")!.value = 0;
        vm.color("characterColor")!.value = 0xff7a5cc8;
      },
      tick(rive, { mode, level, dt, t, canvas }) {
        const vm = rive.viewModelInstance;
        if (!vm) return;
        const target = mode === "speaking" ? Math.min(1, level * 1.3) : 0;
        mouth += (target - mouth) * Math.min(1, dt * 18);
        vm.boolean("isTalking")!.value = mode === "speaking";
        vm.number("mouthHeight")!.value = Math.round(mouth * 100);
        vm.number("mouthWidth")!.value = Math.round(55 + mouth * 45);
        // Looks around while thinking, looks up to listen; otherwise the visitor's cursor drives the head.
        if (mode === "thinking") lookAt(canvas, 0.5 + Math.sin(t * 1.8) * 0.45, 0.3 + Math.cos(t * 1.1) * 0.2);
        else if (mode === "listening") lookAt(canvas, 0.5, 0.05);
        else if (steering) lookAt(canvas, 0.5, 0.5);
        steering = mode === "thinking" || mode === "listening";
      },
    };
  },
};

// Rive's layout bounds say where on the canvas the whole artboard is drawn, so to show only
// the crop we draw the artboard bigger than the canvas (cover-style) and shift it.
function cropLayout(canvas: HTMLCanvasElement, artboard: { w: number; h: number }, crop: Crop) {
  const s = Math.max(canvas.width / crop.w, canvas.height / crop.h);
  const offX = (canvas.width - crop.w * s) / 2 - crop.x * s;
  const offY = (canvas.height - crop.h * s) / 2 - crop.y * s;
  return new Layout({ fit: Fit.Fill, minX: offX, minY: offY, maxX: offX + artboard.w * s, maxY: offY + artboard.h * s });
}

type Props = {
  character: Character;
  mode: AvatarMode;
  /** Current loudness of the host's voice, 0 to 1. */
  getLevel: () => number;
  reaction?: Reaction;
};

export default function Avatar({ character, mode, getLevel, reaction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(getLevel);
  const riveRef = useRef<{ rive: Rive; driver: Driver } | null>(null);
  modeRef.current = mode;
  levelRef.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current!;
    RuntimeLoader.setWasmUrl("/rive.wasm");
    const driver = DRIVERS[character.id]();
    let raf = 0;
    let disposed = false;
    let level = 0;
    let last = performance.now();
    const start = last;

    const rive = new Rive({
      src: character.src,
      canvas,
      autoplay: true,
      ...driver.options,
      onLoad: () => {
        if (disposed) return;
        fit();
        driver.onLoad(rive);
        riveRef.current = { rive, driver };
        raf = requestAnimationFrame(tick);
      },
    });

    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const m = modeRef.current;
      const raw = m === "speaking" ? levelRef.current() : 0;
      level += (raw - level) * (raw > level ? 0.5 : 0.15);
      driver.tick(rive, { mode: m, level, dt, t: (now - start) / 1000, canvas });
      raf = requestAnimationFrame(tick);
    }

    function fit() {
      rive.resizeDrawingSurfaceToCanvas();
      const b = rive.bounds;
      rive.layout = cropLayout(canvas, { w: b.maxX - b.minX, h: b.maxY - b.minY }, character.crop);
    }
    window.addEventListener("resize", fit);

    return () => {
      disposed = true;
      riveRef.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      rive.cleanup();
    };
  }, [character]);

  useEffect(() => {
    const current = riveRef.current;
    if (reaction && current) current.driver.react?.(current.rive, reaction.kind);
  }, [reaction]);

  return <canvas ref={canvasRef} className="avatar-canvas" aria-label={`${character.name}, your host`} />;
}
