import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png'],
        manifest: {
          name: "NutriLens",
          short_name: "NutriLens",
          description: "AI Калоризатор",
          theme_color: "#10B981",
          background_color: "#F9FAFB",
          display: "standalone",
          icons: [
            {
              src: "pwa-64x64.png",
              sizes: "64x64",
              type: "image/png",
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      }),
    ],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        // Разбиваем бандл на чанки, чтобы:
        // 1) react/react-dom жили в отдельном chunk — он редко меняется и
        //    отлично кэшируется service worker'ом между обновлениями.
        // 2) Тяжёлые библиотеки (recharts, react-markdown) — в своих chunk'ах,
        //    они подгружаются только на соответствующих экранах через React.lazy.
        // 3) genai SDK отделён от ядра приложения.
        output: {
          manualChunks: {
            'vendor-ai': ['@google/genai'],
            'vendor-charts': ['recharts'],
            'vendor-markdown': ['react-markdown'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
    },
  };
});
