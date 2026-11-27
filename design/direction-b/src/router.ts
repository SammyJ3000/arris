import { useEffect, useState } from "react";

export interface Route {
  path: string;
  parts: string[];
  query: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/signin";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : "/" + pathPart;
  const parts = path.split("/").filter(Boolean);
  const query: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v = "1"] = pair.split("=");
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return { path, parts, query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string) {
  const target = to.startsWith("#") ? to : "#" + to;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function back(fallback: string) {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
