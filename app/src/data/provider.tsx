import { createContext, useContext, type ReactNode } from "react";
import type { DataSource } from "./source";

const Ctx = createContext<DataSource | null>(null);

/** Put a DataSource at the root. Screens never import a source directly. */
export function DataProvider({ source, children }: { source: DataSource; children: ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

export function useDataSource(): DataSource {
  const s = useContext(Ctx);
  if (!s) throw new Error("useDataSource must be used inside DataProvider");
  return s;
}
