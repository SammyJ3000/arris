// Bits shared by the signed-in screens: the top bar wired to the session and
// connectivity, and the standard read-state handling.

import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useConnectivity, useSession, type Query } from "@/data";
import { Button, EmptyState, TopBar, type TopBarProps } from "@/design-system";

const OFFICE_NAV = [
  { to: "/today", label: "Today" },
  { to: "/board", label: "Board" },
  { to: "/settings", label: "People" },
];

export function AppTopBar(props: Omit<TopBarProps, "person" | "online" | "pending" | "onSwitchPerson" | "nav">) {
  const { session, signOut } = useSession();
  const { online, pending } = useConnectivity();
  const navigate = useNavigate();
  const office = session && session.person.role !== "operative";
  // The office nav already names the page, so the title only appears on
  // pages that are not in the nav, such as a job.
  const title = office && !props.back ? undefined : props.title;
  return (
    <TopBar
      {...props}
      title={title}
      person={session?.person ?? null}
      online={online}
      pending={pending}
      nav={office ? OFFICE_NAV : undefined}
      onSwitchPerson={async () => {
        await signOut();
        navigate(session?.method === "office" ? "/signin/office" : "/signin");
      }}
    />
  );
}

/** The error branch of a read, with a way out. */
export function LoadError({ query, what, children }: { query: Extract<Query<unknown>, { status: "error" }>; what: string; children?: ReactNode }) {
  return (
    <EmptyState
      tone="error"
      icon={<WarningCircle size={30} weight="bold" />}
      title={`Couldn't load ${what}`}
      actions={
        <>
          <Button size="lg" variant="primary" onClick={query.retry}>
            Try again
          </Button>
          {children}
        </>
      }
    >
      {query.error.message} Nothing you've done has been lost; the tablet keeps what it had.
    </EmptyState>
  );
}
