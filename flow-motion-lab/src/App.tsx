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

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-full flex-col">
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
      <footer className="border-t border-line bg-surface-soft py-6 text-center text-xs text-ink-faint">
        <p>
          🌊 <span className="font-semibold text-ink-soft">Flow Motion Lab</span> · เห็นการไหล
          เข้าใจของไหล
        </p>
        <p className="mt-1">สื่อการเรียนรู้ Fluid Mechanics แบบเห็นภาพเคลื่อนไหว · คำนวณทั้งหมดในเบราว์เซอร์</p>
      </footer>
    </div>
  );
}
