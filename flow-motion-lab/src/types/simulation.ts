import type { ComponentType } from "react";

/** The three learning modes every simulation supports. */
export type LearningMode = "explore" | "guided" | "challenge";

export const LEARNING_MODES: { id: LearningMode; label: string; icon: string }[] = [
  { id: "explore", label: "สำรวจอิสระ Explore", icon: "🧪" },
  { id: "guided", label: "เรียนทีละขั้น Guided", icon: "🧭" },
  { id: "challenge", label: "โจทย์ท้าทาย Challenge", icon: "🎯" },
];

/** Toggleable visualisation layers. Not every sim uses every layer. */
export interface VizToggles {
  particles: boolean;
  streamlines: boolean;
  vectors: boolean;
  pressure: boolean;
  graph: boolean;
  formula: boolean;
}

export const DEFAULT_TOGGLES: VizToggles = {
  particles: true,
  streamlines: true,
  vectors: true,
  pressure: true,
  graph: true,
  formula: true,
};

/** Which toggles a given simulation actually exposes. */
export type ToggleKey = keyof VizToggles;

/** One step in Guided mode. */
export interface GuidedStep {
  title: string;
  body: string;
  /** Optional: apply parameter values when the learner reaches this step. */
  apply?: Record<string, number>;
}

/** A Challenge goal with a predicate over the live result object. */
export interface Challenge {
  id: string;
  title: string;
  hint: string;
  /** Returns true when the goal is satisfied. `r` is the sim's result object. */
  isSolved: (r: Record<string, number>) => boolean;
  success: string;
}

/** One multiple-choice quiz item shown beneath a simulation. */
export interface QuizItem {
  question: string;
  choices: string[];
  answer: number;
  explain: string;
}

/** Registry metadata describing a simulation for the dashboard & router. */
export interface SimMeta {
  id: string;
  title: string;
  titleEn: string;
  tagline: string;
  /** Emoji used on cards / nav. */
  icon: string;
  /** Tailwind gradient classes for the card accent. */
  accent: string;
  /** Key formula shown on the card, e.g. "A₁V₁ = A₂V₂". */
  formula: string;
  /** Whether the full simulation is built (MVP) or still coming. */
  status: "ready" | "soon";
  /** Small looping preview for the dashboard card. */
  Preview?: ComponentType;
  /** The full simulation experience. */
  Sim?: ComponentType;
}
