import { ArrowLeft, WifiSlash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { Avatar, Wordmark } from "./ui";

export function TopBar({
  title,
  back,
  actions,
  dense,
}: {
  title?: string;
  back?: string;
  actions?: ReactNode;
  dense?: boolean;
}) {
  const { session, online, signOut } = useStore();
  return (
    <header className={`topbar ${dense ? "topbar--dense" : ""}`}>
      <div className="topbar__left">
        {back ? (
          <button className="icon-btn" aria-label="Back" onClick={() => navigate(back)}>
            <ArrowLeft size={24} />
          </button>
        ) : (
          <Wordmark size={dense ? 20 : 24} />
        )}
        {title && <span className="topbar__title">{title}</span>}
      </div>
      <div className="topbar__right">
        {!online && (
          <span className="pill pill--tone-offline topbar__offline">
            <WifiSlash size={16} weight="bold" />
            Offline
          </span>
        )}
        {actions}
        {session && (
          <button
            className="person-chip"
            onClick={() => {
              signOut();
              navigate("/signin");
            }}
            title="Switch person"
          >
            <Avatar person={session} size={dense ? 28 : 36} />
            <span className="person-chip__name">{session.name.split(" ")[0]}</span>
          </button>
        )}
      </div>
    </header>
  );
}
