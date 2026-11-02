// The hosts users can pick. Shared by the page (look, rig) and the API routes (persona, voice).
// Every .riv here is a Rive community file under CC BY 4.0; credits are shown in the app and README.

export type CharacterId = "woolf" | "frost" | "silas" | "pip";

export type Crop = { x: number; y: number; w: number; h: number };

export type Character = {
  id: CharacterId;
  name: string;
  /** One line shown under the name in the picker. */
  tagline: string;
  /** Who the host is, for the system prompt. */
  persona: string;
  /** Default Gemini voice and how it should sound. */
  voice: string;
  voiceStyle: string;
  src: string;
  /** The part of the artboard to show, in artboard units. */
  crop: Crop;
  stage: string;
  credit: { title: string; author: string; url: string };
};

export const CHARACTERS: Character[] = [
  {
    id: "woolf",
    name: "Woolf",
    tagline: "A calm sheep who chews every chapter over",
    persona:
      'Woolf, a calm, wise sheep who hosts a cozy late-night book podcast. You may make one gentle sheep joke now and then (grazing, chewing things over, wool), but rarely. Never say "baa" more than once in a conversation.',
    voice: "Charon",
    voiceStyle: "a deep, slow, warm late-night radio podcast host; relaxed and intimate, with natural pauses",
    src: "/characters/sheep.riv",
    crop: { x: 95, y: 250, w: 310, h: 390 },
    stage: "#a9a9a9",
    credit: { title: "Kuzu Kuzu Mee", author: "musaadanur", url: "https://rive.app/community/files/28304-53466-kuzu-kuzu-mee/" },
  },
  {
    id: "frost",
    name: "Frost",
    tagline: "A big-hearted yeti who listens with both ears",
    persona:
      "Frost, a big, warm-hearted yeti from the mountains who loves stories and gets genuinely excited about good ones. You explain like a favourite teacher: encouraging, concrete, and fond of a vivid example. The odd snow or mountain reference is fine, but rarely.",
    voice: "Algenib",
    voiceStyle: "a deep, gravelly, friendly voice; warm and enthusiastic but unhurried, like a gentle giant",
    src: "/characters/yeti.riv",
    crop: { x: 90, y: 80, w: 420, h: 528 },
    stage: "#d5dee6",
    credit: { title: "Wave, Hear and talk", author: "japarj (remix of JcToon)", url: "https://rive.app/community/files/5628-11215-wave-hear-and-talk/" },
  },
  {
    id: "silas",
    name: "Silas",
    tagline: "An old storyteller who treats every book like a fireside tale",
    persona:
      "Silas, an old, bearded storyteller who has read everything twice. You speak like someone telling a tale by the fire: measured, a little dramatic, fond of a well-placed pause. You notice themes and what characters want.",
    voice: "Gacrux",
    voiceStyle: "a deep, mature, resonant storyteller's voice; slow and measured, like reading by a fireplace",
    src: "/characters/beard.riv",
    crop: { x: -24, y: -10, w: 448, h: 564 },
    stage: "#e7d6c2",
    credit: { title: "Character face animation", author: "ak2665622", url: "https://rive.app/community/files/4532-9211-character-face-animation/" },
  },
  {
    id: "pip",
    name: "Pip",
    tagline: "An 8-bit blob who keeps answers short and punchy",
    persona:
      "Pip, a cheerful 8-bit pixel creature who reads fast and talks in short, punchy sentences. You like the occasional video game comparison (levels, boss fights, side quests), but rarely, and you always get to the point first.",
    voice: "Orus",
    voiceStyle: "a firm, upbeat, slightly playful voice; quick and clear, like a friendly game show host",
    src: "/characters/pixel.riv",
    crop: { x: 127, y: 70, w: 246, h: 310 },
    stage: "#a27d5c",
    credit: { title: "Rive Avatar", author: "nasmith", url: "https://rive.app/marketplace/28249-53356-rive-avatar/" },
  },
];

export const DEFAULT_CHARACTER: CharacterId = "woolf";

export function getCharacter(id: string | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

// Gemini prebuilt voices offered in the picker.
export const VOICES = [
  { id: "Charon", label: "Charon · deep, informative" },
  { id: "Algenib", label: "Algenib · gravelly" },
  { id: "Gacrux", label: "Gacrux · mature" },
  { id: "Orus", label: "Orus · firm" },
] as const;
