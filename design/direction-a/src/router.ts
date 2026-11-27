import { useEffect, useState } from "react";

export interface Route {
  path: string; // "/jobs"
  parts: string[]; // ["jobs"]
  query: URLSearchParams;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, "") || "/signin";
  const [p, q = ""] = h.split("?");
  const path = p.startsWith("/") ? p : "/" + p;
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

export function go(to: string) {
  window.location.hash = to.startsWith("#") ? to : "#" + to;
}

export const href = (to: string) => "#" + to;
