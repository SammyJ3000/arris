/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // .env.local lives at the repo root, shared with supabase/tests. Vite only
  // exposes VITE_ variables to the app: the Supabase URL, the publishable key
  // and the PowerSync URL, all public by design.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Arris",
        short_name: "Arris",
        description: "Workshop job tracker for joinery and fit-out. Works offline on the bench.",
        lang: "en-GB",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#F2F3F5",
        theme_color: "#F2F3F5",
        categories: ["business", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // The app shell and everything it needs. Drawings get cached by the data
        // layer in a later stage; the typeface comes from Google and is cached
        // the first time it loads.
        // Plus the SQLite engine PowerSync's default storage (IndexedDB) runs
        // on, so the app opens with no signal. The other three builds
        // (encrypted, synchronous) aren't used, so aren't cached.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}", "**/wa-sqlite-async-*.wasm"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // PowerSync runs SQLite in web workers from WASM files. Vite's dependency
  // pre-bundling breaks their URLs, and the workers are ES modules.
  optimizeDeps: { exclude: ["@powersync/web", "@journeyapps/wa-sqlite"] },
  worker: { format: "es" },
  build: {
    target: "es2022",
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          motion: ["motion"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
