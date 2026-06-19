import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { readJSON, writeJSON } from "../utils/storage";

/**
 * Tracks per-lesson learning progress and quiz scores in localStorage so a
 * learner can close the tab and come back where they left off.
 */
export interface QuizScore {
  /** Number of questions answered correctly. */
  correct: number;
  /** Total questions in the attempt. */
  total: number;
  /** ISO timestamp of the attempt. */
  takenAt: string;
}

interface ProgressState {
  /** Lesson ids the learner has marked complete / visited the quiz of. */
  completedLessons: string[];
  /** Best quiz score keyed by lesson id. */
  quizScores: Record<string, QuizScore>;
}

interface ProgressContextValue extends ProgressState {
  markComplete: (lessonId: string) => void;
  isComplete: (lessonId: string) => boolean;
  recordQuizScore: (lessonId: string, score: QuizScore) => void;
  resetProgress: () => void;
  /** completion fraction across the provided total lesson count. */
  completionFraction: (totalLessons: number) => number;
}

const STORAGE_KEY = "progress";
const DEFAULT_STATE: ProgressState = { completedLessons: [], quizScores: {} };

const ProgressContext = createContext<ProgressContextValue | undefined>(
  undefined,
);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(() =>
    readJSON<ProgressState>(STORAGE_KEY, DEFAULT_STATE),
  );

  // Persist on every change through a single helper.
  const persist = useCallback((next: ProgressState) => {
    setState(next);
    writeJSON(STORAGE_KEY, next);
  }, []);

  const markComplete = useCallback(
    (lessonId: string) => {
      setState((prev) => {
        if (prev.completedLessons.includes(lessonId)) return prev;
        const next = {
          ...prev,
          completedLessons: [...prev.completedLessons, lessonId],
        };
        writeJSON(STORAGE_KEY, next);
        return next;
      });
    },
    [],
  );

  const isComplete = useCallback(
    (lessonId: string) => state.completedLessons.includes(lessonId),
    [state.completedLessons],
  );

  const recordQuizScore = useCallback(
    (lessonId: string, score: QuizScore) => {
      setState((prev) => {
        const existing = prev.quizScores[lessonId];
        // Keep the best attempt (highest correct ratio).
        const keepNew =
          !existing ||
          score.correct / score.total >= existing.correct / existing.total;
        const next: ProgressState = {
          completedLessons: prev.completedLessons.includes(lessonId)
            ? prev.completedLessons
            : [...prev.completedLessons, lessonId],
          quizScores: {
            ...prev.quizScores,
            [lessonId]: keepNew ? score : existing,
          },
        };
        writeJSON(STORAGE_KEY, next);
        return next;
      });
    },
    [],
  );

  const resetProgress = useCallback(() => persist(DEFAULT_STATE), [persist]);

  const completionFraction = useCallback(
    (totalLessons: number) =>
      totalLessons > 0
        ? Math.min(1, state.completedLessons.length / totalLessons)
        : 0,
    [state.completedLessons.length],
  );

  const value = useMemo(
    () => ({
      ...state,
      markComplete,
      isComplete,
      recordQuizScore,
      resetProgress,
      completionFraction,
    }),
    [
      state,
      markComplete,
      isComplete,
      recordQuizScore,
      resetProgress,
      completionFraction,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within a ProgressProvider");
  return ctx;
}
