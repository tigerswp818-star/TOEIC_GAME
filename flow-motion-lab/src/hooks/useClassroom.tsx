import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ClassroomCtx {
  /** When true: hide advanced controls, enlarge labels (teacher projection). */
  active: boolean;
  toggle: () => void;
  setActive: (v: boolean) => void;
}

const Ctx = createContext<ClassroomCtx | null>(null);

/** Classroom Mode state, shared so any sim control can adapt to it. */
export function ClassroomProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const toggle = useCallback(() => setActive((a) => !a), []);
  return <Ctx.Provider value={{ active, toggle, setActive }}>{children}</Ctx.Provider>;
}

export function useClassroom(): ClassroomCtx {
  const ctx = useContext(Ctx);
  // Safe default so shared components work even outside a provider (e.g. tests).
  return ctx ?? { active: false, toggle: () => {}, setActive: () => {} };
}
