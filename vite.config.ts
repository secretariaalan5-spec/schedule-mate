import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      // Suporte a celulares Android antigos (Chrome/WebView 61+)
      mode !== "development" &&
        legacy({
          targets: ["chrome >= 61", "android >= 6", "safari >= 11", "ios >= 11"],
          modernPolyfills: true,
          renderLegacyChunks: true,
          polyfills: [
            "es.promise",
            "es.promise.finally",
            "es.object.assign",
            "es.object.entries",
            "es.object.from-entries",
            "es.array.flat",
            "es.array.flat-map",
            "es.array.includes",
            "es.array.at",
            "es.string.at-alternative",
            "es.string.replace-all",
            "es.string.includes",
            "es.string.trim-start",
            "es.string.trim-end",
            "es.symbol",
            "es.map",
            "es.set",
            "es.global-this",
            "esnext.array.at",
            "esnext.string.replace-all",
            "web.url",
            "web.url-search-params",
            "web.dom-collections.iterator",
          ],
        }),
    ].filter(Boolean),
    build: {
      target: "es2015",
      cssTarget: "chrome61",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
