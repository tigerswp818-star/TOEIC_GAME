import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LessonPage } from "./pages/LessonPage";
import { FormulaSheetPage } from "./pages/FormulaSheetPage";
import { UnitConverterPage } from "./pages/UnitConverterPage";
import { QuizPage } from "./pages/QuizPage";
import { ExamplesPage } from "./pages/ExamplesPage";
import { GlossaryPage } from "./pages/GlossaryPage";

/**
 * Routing. HashRouter keeps deployment configuration-free on static hosts
 * (e.g. GitHub Pages sub-paths) — no server rewrites needed.
 *
 * The landing page is standalone; everything else lives inside the Layout shell
 * (sidebar + top bar).
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/formulas" element={<FormulaSheetPage />} />
          <Route path="/converter" element={<UnitConverterPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/examples" element={<ExamplesPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
        </Route>
        {/* unknown routes → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
