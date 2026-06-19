import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built asset URLs relative, so the production bundle works
// no matter what sub-path it is served from (e.g. GitHub Pages /repo/). Combined
// with HashRouter this keeps deployment configuration-free.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
