import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Learner progress, persisted to localStorage. */
interface ProgressState {
  /** Chapter ids opened. */
  chapters: string[];
  /** Simulation ids tried. */
  sims: string[];
  /** Challenge titles solved (titles are unique enough across the app). */
  challenges: string[];
  /** Quiz tally across the whole app. */
  quizCorrect: number;
  quizAnswered: number;
}

interface ProgressCtx extends ProgressState {
  markChapter: (id: string) => void;
  markSim: (id: string) => void;
  markChallengeSolved: (title: string) => void;
  recordQuiz: (correct: boolean) => void;
  reset: () => void;
}

const STORAGE_KEY = "fml-progress";
const EMPTY: ProgressState = {
  chapters: [],
  sims: [],
  challenges: [],
  quizCorrect: 0,
  quizAnswered: 0,
};

const Ctx = createContext<ProgressCtx | null>(null);

const load = (): ProgressState => {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<ProgressState>) };
  } catch {
    return EMPTY;
  }
};

/** Tracks which chapters/sims were explored, challenges solved and quiz tally. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addUnique = useCallback((key: "chapters" | "sims" | "challenges", id: string) => {
    setState((s) => (s[key].includes(id) ? s : { ...s, [key]: [...s[key], id] }));
  }, []);

  const markChapter = useCallback((id: string) => addUnique("chapters", id), [addUnique]);
  const markSim = useCallback((id: string) => addUnique("sims", id), [addUnique]);
  const markChallengeSolved = useCallback(
    (title: string) => addUnique("challenges", title),
    [addUnique],
  );
  const recordQuiz = useCallback(
    (correct: boolean) =>
      setState((s) => ({
        ...s,
        quizAnswered: s.quizAnswered + 1,
        quizCorrect: s.quizCorrect + (correct ? 1 : 0),
      })),
    [],
  );
  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo<ProgressCtx>(
    () => ({ ...state, markChapter, markSim, markChallengeSolved, recordQuiz, reset }),
    [state, markChapter, markSim, markChallengeSolved, recordQuiz, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used within <ProgressProvider>");
  return ctx;
}
