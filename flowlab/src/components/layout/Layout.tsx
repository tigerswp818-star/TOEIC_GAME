import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

/** App shell with a sticky sidebar (desktop) / drawer (mobile) and a top bar. */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="เปิดเมนู"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-lg lg:hidden dark:border-slate-700 dark:bg-slate-900"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
            FlowLab · เรียน Fluid Mechanics แบบเห็นภาพ
          </div>
          <ThemeToggle />
        </header>

        <main
          key={location.pathname}
          className="mx-auto w-full max-w-5xl flex-1 animate-fade-in px-4 py-6 sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
          FlowLab — สื่อการเรียน Fluid Mechanics แบบ interactive · คำนวณทั้งหมดในฝั่ง client
        </footer>
      </div>
    </div>
  );
}
