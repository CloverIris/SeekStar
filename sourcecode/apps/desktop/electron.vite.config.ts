import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

function copySplashHtmlPlugin() {
  return {
    name: "copy-splash-html",
    closeBundle() {
      cpSync(resolve("src/main/splash.html"), resolve("out/main/splash.html"));
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySplashHtmlPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react()],
  },
});
