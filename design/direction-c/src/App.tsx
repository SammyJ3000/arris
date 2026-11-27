import { useEffect } from "react";
import { PEOPLE } from "./shared/sample-data";
import { useRoute } from "./state/router";
import { useStore } from "./state/store";
import { PrototypeMenu } from "./components/PrototypeMenu";
import { Toasts } from "./components/Toasts";
import { Board } from "./screens/Board";
import { JobPage } from "./screens/JobPage";
import { MyJobs } from "./screens/MyJobs";
import { OfficeSignIn, SignIn } from "./screens/SignIn";

export function App() {
  const route = useRoute();
  const { session, signIn } = useStore();
  const [first] = route.parts;

  // A direct link to a signed-in screen signs in the person that screen is
  // written for, so the published prototype opens anywhere.
  useEffect(() => {
    if (session) return;
    const as = route.query.get("as");
    if (first === "board" || as === "steve") signIn(PEOPLE.find((p) => p.id === "p-steve")!);
    else if (first === "jobs" || first === "job") signIn(PEOPLE.find((p) => p.id === "p-tom")!);
  }, [first, route, session, signIn]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  let screen: React.ReactNode;
  switch (first) {
    case "office":
      screen = <OfficeSignIn />;
      break;
    case "jobs":
      screen = session ? <MyJobs route={route} /> : null;
      break;
    case "job":
      screen = session ? <JobPage route={route} id={route.parts[1]} /> : null;
      break;
    case "board":
      screen = session ? <Board route={route} /> : null;
      break;
    default:
      screen = <SignIn route={route} />;
  }

  return (
    <>
      {screen}
      <Toasts />
      <PrototypeMenu />
    </>
  );
}
