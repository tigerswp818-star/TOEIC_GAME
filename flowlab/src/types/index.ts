/**
 * Shared TypeScript types for FlowLab.
 *
 * Physical quantities are plain `number`s in SI base units. We use branded-ish
 * doc comments instead of nominal types to keep the maths ergonomic while still
 * documenting the expected unit at every boundary.
 */

import type { ComponentType } from "react";

/** Flow regime classification from the Reynolds number. */
export type FlowRegime = "laminar" | "transitional" | "turbulent";

/** Buoyancy outcome for an object placed in a fluid. */
export type BuoyancyState = "float" | "sink" | "neutral";

/** A single physics result paired with its unit, ready to render. */
export interface PhysicsResult {
  /** The computed numeric value in the given unit. */
  value: number;
  /** Unit string, e.g. "Pa", "m/s". */
  unit: string;
}

/** Input-validation message attached to a simulator field. */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: "warning" | "error";
}

/** A lesson/module in the learning map. */
export interface Lesson {
  /** URL-safe id, also the localStorage progress key. */
  id: string;
  /** Chapter number shown in the path, e.g. 1. `null` for special chapters. */
  order: number | null;
  title: string;
  titleEn: string;
  /** One-line teaser for cards. */
  summary: string;
  /** Lucide-style emoji/icon glyph for quick visual scanning. */
  icon: string;
  /** Tailwind gradient classes for the card accent. */
  accent: string;
  /** The route this lesson lives at, relative to the app root. */
  path: string;
}

/** Glossary entry for the mini-glossary and tooltips. */
export interface GlossaryTerm {
  term: string;
  termEn: string;
  definition: string;
}

/** A variable description inside a formula box. */
export interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit: string;
}

/** A formula-sheet entry. */
export interface FormulaEntry {
  id: string;
  name: string;
  nameEn: string;
  /** Human-readable formula, e.g. "P = ρ·g·h". */
  expression: string;
  variables: FormulaVariable[];
  /** Short worked example string. */
  example: string;
  /** Caution / common pitfall note. */
  caution: string;
  /** Lesson id this formula belongs to, for cross-linking. */
  lessonId: string;
}

/** Quiz question variants. */
export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | NumericQuestion;

interface QuizBase {
  id: string;
  /** Lesson id this question belongs to. */
  lessonId: string;
  prompt: string;
  /** Explanation shown after answering — the "why". */
  explanation: string;
}

export interface MultipleChoiceQuestion extends QuizBase {
  type: "mcq";
  options: string[];
  /** Index of the correct option. */
  answerIndex: number;
}

export interface TrueFalseQuestion extends QuizBase {
  type: "boolean";
  answer: boolean;
}

export interface NumericQuestion extends QuizBase {
  type: "numeric";
  /** Expected numeric answer. */
  answer: number;
  unit: string;
  /** Absolute tolerance for accepting the answer. */
  tolerance: number;
  /** Optional hint about how to compute it. */
  hint?: string;
}

/** A real-world example card. */
export interface RealWorldExample {
  id: string;
  title: string;
  icon: string;
  /** Short "the question" hook. */
  question: string;
  /** The explanation, plain language. */
  explanation: string;
  /** Which concepts/lessons it connects to. */
  relatedLessonIds: string[];
}

/** Definition for a simulator component embedded in a lesson. */
export interface SimulatorDef {
  component: ComponentType;
}
