import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { useTheme } from "./hooks/useTheme";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import ChapterPage from "./pages/ChapterPage";
import SimulationPage from "./pages/SimulationPage";
import FormulaSheetPage from "./pages/FormulaSheetPage";
import UnitConverterPage from "./pages/UnitConverterPage";
import GlossaryPage from "./pages/GlossaryPage";
import RealWorldPage from "./pages/RealWorldPage";
import NotFoundPage from "./pages/NotFoundPage";

/** Scrolls to top whenever the route changes. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/**
 * Fixed, non-interactive aurora orbs that drift slowly behind every page,
 * layered under all content for an ambient "fluid lab at night" depth.
 */
function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-flow-500/20 blur-3xl animate-float" />
      <div className="absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-iris-500/20 blur-3xl animate-float-slow" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-deep-600/15 blur-3xl animate-float" />
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="relative flex min-h-full flex-col">
      <AmbientBackdrop />
      <ScrollToTop />
      <Navbar theme={theme} onToggleTheme={toggle} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/lab" element={<DashboardPage />} />
          <Route path="/chapter/:id" element={<ChapterPage />} />
          <Route path="/sim/:id" element={<SimulationPage />} />
          <Route path="/formulas" element={<FormulaSheetPage />} />
          <Route path="/converter" element={<UnitConverterPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/real-world" element={<RealWorldPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="relative mt-4 border-t border-line/60 py-8 text-center text-xs text-ink-faint">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flow-400/60 to-transparent" />
        <p className="text-sm">
          <span className="bg-aurora-text bg-clip-text font-bold tracking-tight text-transparent">
            🌊 Flow Motion Lab
          </span>
          <span className="text-ink-faint"> · เห็นการไหล เข้าใจของไหล</span>
        </p>
        <p className="mt-1.5">สื่อการเรียนรู้ Fluid Mechanics แบบเห็นภาพเคลื่อนไหว · คำนวณทั้งหมดในเบราว์เซอร์</p>
      </footer>
    </div>
  );
}
