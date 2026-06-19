/** Rich learning content attached to each chapter (Thai-first). */
export interface WorkedExample {
  /** Short title, e.g. "หาความดันที่ก้นถัง". */
  title: string;
  /** The formula being applied, e.g. "P = ρgh". */
  formula: string;
  /** Given values (Thai), one line. */
  given: string;
  /** Step-by-step solution lines (include unit conversions where relevant). */
  steps: string[];
  /** Final answer with units. */
  answer: string;
  /** One-line interpretation of the result. */
  interpret: string;
}

export interface ChapterContent {
  /** 1–2 paragraph plain-language core concept (Thai). */
  coreConcept: string;
  /** Key assumptions / limitations for the chapter's main model. */
  assumptions: string[];
  /** A fully worked, step-by-step example for the chapter's key formula. */
  workedExample: WorkedExample;
  /** One-sentence "remember this" takeaway. */
  keyTakeaway: string;
  /** A real-world engineering example tied to the chapter. */
  realWorld: { title: string; body: string };
  /** Teacher notes shown in Classroom Mode (Phase 3). */
  teacherNotes: string[];
}
