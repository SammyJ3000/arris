import { useEffect, useState } from "react";
import { PEOPLE } from "./shared/sample-data";
import { useRoute, go } from "./router";
import { useStore } from "./state";
import { Toasts } from "./components/ui";
import { ProtoMenu } from "./components/ProtoMenu";
import { SignIn } from "./screens/SignIn";
import { MyJobs } from "./screens/MyJobs";
import { JobPage, DrawingViewer } from "./screens/JobPage";
import { Board } from "./screens/Board";
import { States } from "./screens/States";

type Tab = "drawing" | "cuts" | "materials" | "notes";

export default function App() {
  const route = useRoute();
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>("drawing");

  // Prototype conveniences: `?as=tom` signs that person in, and a route that
  // needs someone signed in picks a sensible default. The real app redirects
  // to sign-in instead.
  const as = route.query.get("as");
  const needsUser = route.parts[0] === "jobs" || route.parts[0] === "job" || route.parts[0] === "board" || route.parts[0] === "states";
  const wanted = as ? PEOPLE.find((p) => p.id === `p-${as}`) : null;
  useEffect(() => {
    if (wanted && state.user?.id !== wanted.id) dispatch({ type: "signin", user: wanted });
    else if (!state.user && needsUser) {
      const fallback = PEOPLE.find((p) => p.id === (route.parts[0] === "board" ? "p-steve" : "p-tom"))!;
      dispatch({ type: "signin", user: fallback });
    }
  }, [route.path, as]);

  useEffect(() => {
    if (route.query.has("offline")) dispatch({ type: "offline", on: route.query.get("offline") !== "0" });
    dispatch({ type: "loading", on: route.query.get("loading") === "1" });
  }, [route.path, route.query.toString()]);

  useEffect(() => {
    const t = route.query.get("tab") as Tab | null;
    if (t) setTab(t);
  }, [route.query.toString()]);

  // Until the sign-in effect has run, the user we are about to become.
  const user = wanted ?? state.user;
  const ready = !needsUser || (state.user && (!wanted || state.user.id === wanted.id));

  let screen: JSX.Element;
  const head = route.parts[0];
  if (!ready) {
    screen = <div style={{ minHeight: "100dvh" }} aria-busy="true" />;
  } else if (head === "signin") {
    screen = <SignIn office={route.parts[1] === "office"} presetPerson={route.query.get("who") ? `p-${route.query.get("who")}` : undefined} presetWrong={route.query.get("wrong") === "1"} />;
  } else if (head === "jobs" && user) {
    screen = <MyJobs key={user.id} />;
  } else if (head === "job" && user) {
    const job = state.jobs.find((j) => j.id === route.parts[1]);
    if (!job) {
      screen = <NotFound id={route.parts[1]} />;
    } else if (route.parts[2] === "drawing") {
      screen = <DrawingViewer job={job} rev={route.query.get("rev") ?? "C"} />;
    } else {
      screen = (
        <JobPage
          key={job.id + user.id}
          job={job}
          tab={tab}
          setTab={setTab}
          flags={{ conflict: route.query.get("conflict") === "1", error: route.query.get("error") === "1" }}
        />
      );
    }
  } else if (head === "board" && user) {
    screen = <Board />;
  } else if (head === "states") {
    screen = <States />;
  } else {
    screen = <SignIn />;
  }

  return (
    <>
      {screen}
      <Toasts />
      <ProtoMenu />
    </>
  );
}

function NotFound({ id }: { id?: string }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="outline" style={{ padding: 40, textAlign: "center", maxWidth: 520 }}>
        <div className="num" style={{ fontSize: "var(--fs-64)", color: "var(--line-strong)" }}>{id ?? "?"}</div>
        <p style={{ fontSize: "var(--fs-18)", marginTop: 8 }}>There's no job with that number on the board. It may have been delivered and archived.</p>
        <button className="btn btn-ink btn-lg" style={{ marginTop: 20 }} onClick={() => go("/jobs")}>
          Back to my jobs
        </button>
      </div>
    </main>
  );
}
