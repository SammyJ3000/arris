import { Compass } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { useSession } from "@/data";
import { Button, EmptyState } from "@/design-system";
import { homeFor } from "@/app/App";

export function NotFound() {
  const navigate = useNavigate();
  const { session } = useSession();
  return (
    <div className="notfound">
      <EmptyState tone="neutral" icon={<Compass size={30} weight="bold" />} title="There's nothing at this address" actions={<Button size="lg" variant="primary" onClick={() => navigate(session ? homeFor(session.person.role) : "/signin")}>{session ? "Back to your jobs" : "Sign in"}</Button>}>
        The link may be old, or mistyped. Nothing has been lost.
      </EmptyState>
    </div>
  );
}
