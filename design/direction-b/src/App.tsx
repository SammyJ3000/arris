import { useEffect } from "react";
import { useRoute, navigate } from "./router";
import { useStore } from "./store";
import { PEOPLE } from "./shared/sample-data";
import { SignIn, OfficeSignIn } from "./screens/SignIn";
import { MyJobs } from "./screens/MyJobs";
import { JobPage } from "./screens/JobPage";
import { DrawingViewer } from "./screens/DrawingViewer";
import { Board } from "./screens/Board";
import { Toasts } from "./components/overlays";

const AS: Record<string, string> = { tom: "p-tom", steve: "p-steve", helen: "p-helen", ryan: "p-ryan", gareth: "p-gareth" };

export function App() {
  const route = useRoute();
  const { state, dispatch } = useStore();
  const [first, second, third] = route.parts;
  const q = route.query;

  // Deep links from the prototype menu carry ?as=tom so every area is reachable
  // without walking through sign-in each time.
  useEffect(() => {
    if (q.as && AS[q.as]) {
      const p = PEOPLE.find((x) => x.id === AS[q.as])!;
      if (state.user?.id !== p.id) dispatch({ type: "sign-in", person: p });
    }
    if (q.offline !== undefined) dispatch({ type: "set-offline", offline: q.offline === "1" });
  }, [route.path, q.as, q.offline]);

  useEffect(() => {
    document.title = "Datum";
    window.scrollTo(0, 0);
  }, [route.path]);

  const signedIn = !!state.user || (q.as && AS[q.as]);
  const needsUser = first && first !== "signin" && first !== "office";
  useEffect(() => {
    if (needsUser && !signedIn) navigate("/signin");
  }, [needsUser, signedIn]);

  let screen: React.ReactNode;
  if (!first || first === "signin") screen = <SignIn wrongDemo={q.wrong === "1"} key={q.wrong} />;
  else if (first === "office") screen = <OfficeSignIn />;
  else if (!signedIn) screen = null;
  else if (first === "jobs") screen = <MyJobs simulateLoading={q.loading === "1"} key={`${q.loading}-${q.as}`} />;
  else if (first === "job" && second && third === "drawing") screen = <DrawingViewer jobId={second} rev={q.rev} />;
  else if (first === "job" && second)
    screen = (
      <JobPage
        jobId={second}
        key={`${second}-${q.gate}-${q.conflict}-${q.denied}-${q.error}`}
        demo={{ gate: q.gate === "1", conflict: q.conflict === "1", denied: q.denied === "1", error: q.error === "1" }}
      />
    );
  else if (first === "board") screen = <Board simulateLoading={q.loading === "1"} key={q.loading} />;
  else screen = <MyJobs />;

  return (
    <>
      {screen}
      <Toasts />
      {/* Ink bleed for rubber stamps: a touch of turbulence on the edges. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="ink-bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  );
}
