// Hash routing, so the single published file works from any host and the
// prototype menu can jump anywhere.

import { useEffect, useState } from "react";

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/signin";
  const [path, qs = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { path, parts, query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to.startsWith("#") ? to.slice(1) : to;
}
