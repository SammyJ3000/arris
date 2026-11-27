import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useSession } from "@/data";
import type { Role } from "@/domain/domain";
import { Board } from "@/screens/Board";
import { DesignSystem } from "@/screens/DesignSystem";
import { JobPage } from "@/screens/JobPage";
import { MyJobs } from "@/screens/MyJobs";
import { NotFound } from "@/screens/NotFound";
import { OfficeSignIn } from "@/screens/OfficeSignIn";
import { Settings } from "@/screens/Settings";
import { SignIn } from "@/screens/SignIn";
import { Today } from "@/screens/Today";
import { DevMenu } from "./dev";
import { LateOutcomes } from "./LateOutcomes";

/** Where a signed-in person lands. */
export function homeFor(role: Role): string {
  return role === "operative" ? "/jobs" : "/today";
}

function RequireSession({ roles }: { roles?: Role[] }) {
  const { session } = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(session.person.role)) return <Navigate to={homeFor(session.person.role)} replace />;
  return <Outlet />;
}

function Home() {
  const { session } = useSession();
  return <Navigate to={session ? homeFor(session.person.role) : "/signin"} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signin/office" element={<OfficeSignIn />} />
        <Route path="/design-system" element={<DesignSystem />} />
        <Route element={<RequireSession />}>
          <Route path="/jobs" element={<MyJobs />} />
          <Route path="/job/:id" element={<JobPage />} />
          <Route path="/board" element={<Board />} />
        </Route>
        <Route element={<RequireSession roles={["manager", "director"]} />}>
          <Route path="/today" element={<Today />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <LateOutcomes />
      <DevMenu />
    </>
  );
}
