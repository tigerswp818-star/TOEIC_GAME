interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

/** Sun/moon toggle for the lab theme. */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="lab-btn-ghost !px-3 !py-2"
      aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      title={isDark ? "โหมดสว่าง Light" : "โหมดมืด Dark"}
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
