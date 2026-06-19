import type { ReactNode } from "react";
import { Tooltip } from "../ui/Tooltip";
import { findGlossary } from "../../data/glossary";

interface TermProps {
  /** English glossary key, e.g. "Viscosity". */
  termEn: string;
  children: ReactNode;
}

/**
 * Inline glossary term: shows the child text with a dotted underline and a
 * tooltip pulled from the glossary data. Falls back to plain text if unknown.
 */
export function Term({ termEn, children }: TermProps) {
  const entry = findGlossary(termEn);
  if (!entry) return <>{children}</>;
  return (
    <Tooltip
      content={
        <span>
          <strong>
            {entry.term} ({entry.termEn})
          </strong>
          <br />
          {entry.definition}
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}
