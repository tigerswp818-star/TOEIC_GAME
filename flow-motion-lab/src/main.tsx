import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import { ProgressProvider } from "./hooks/useProgress";
import { ClassroomProvider } from "./hooks/useClassroom";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <ProgressProvider>
          <ClassroomProvider>
            <App />
          </ClassroomProvider>
        </ProgressProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
);
