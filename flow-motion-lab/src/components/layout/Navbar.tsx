import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface NavbarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const links = [
  { to: "/lab", label: "แผนที่การเรียน" },
  { to: "/formulas", label: "สูตร Formulas" },
  { to: "/converter", label: "แปลงหน่วย" },
  { to: "/glossary", label: "ศัพท์" },
  { to: "/real-world", label: "ในชีวิตจริง" },
];

/** Top navigation bar shared across pages. */
export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-flow-500/15 text-flow-600 dark:text-flow-300"
        : "text-ink-soft hover:bg-surface-soft hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-flow-400 to-deep-600 text-lg shadow-glow">
            🌊
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">Flow Motion Lab</span>
            <span className="block text-[11px] text-ink-faint">เห็นการไหล เข้าใจของไหล</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/lab" className="hidden lab-btn-primary !py-2 sm:inline-flex">
            เริ่มทดลอง
          </Link>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            className="lab-btn-ghost !px-3 !py-2 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="เมนู"
            aria-expanded={open}
          >
            <span aria-hidden>{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
