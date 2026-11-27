import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { MotionConfig } from "motion/react";
import { registerSW } from "virtual:pwa-register";
import { DataProvider, MemorySource, type DataSource } from "@/data";
import { chooseSource } from "@/data/select";
import { ToastProvider } from "@/design-system";
import { App } from "./app/App";
import { DevProvider, applyUrlScenario } from "./app/dev";
import "./app/screens.css";

// The real back end when it is configured; the in-memory sample workshop when
// it isn't, or with ?source=memory (src/data/select.ts). The screens can't tell
// which, and the dev menu only exists on the memory source.
const choice = chooseSource(window.location.search, import.meta.env, safeSessionStorage());

let source: DataSource;
let memory: MemorySource | null = null;
if (choice.kind === "powersync") {
  const { PowerSyncSource } = await import("@/data/powersync/powerSyncSource");
  source = new PowerSyncSource(choice.config);
} else {
  memory = new MemorySource();
  applyUrlScenario(memory.dev, window.location.search, window.location.pathname);
  source = memory;
}

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <DataProvider source={source}>
        <DevProvider source={memory}>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </DevProvider>
      </DataProvider>
    </MotionConfig>
  </StrictMode>,
);

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
