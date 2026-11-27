import { CaretLeft, SignOut } from "@phosphor-icons/react";
import { Avatar, Btn, Wordmark } from "./ui";
import { useStore } from "../state";
import { go, href } from "../router";
import type { ReactNode } from "react";

export function Topbar({ back, title, children }: { back?: string; title?: string; children?: ReactNode }) {
  const { state, dispatch } = useStore();
  const u = state.user;
  return (
    <header className="topbar">
      {back ? (
        <a href={href(back)} className="btn btn-ghost btn-sm" style={{ minHeight: 44, paddingLeft: 8 }} aria-label="Back">
          <CaretLeft size={20} weight="bold" />
          <span>{title ?? "Back"}</span>
        </a>
      ) : (
        <a href={href(u?.role === "manager" ? "/board" : "/jobs")} aria-label="Shopboard home">
          <Wordmark size={22} />
        </a>
      )}
      {children}
      <div className="topbar-who">
        {u && (
          <>
            <div style={{ textAlign: "right", lineHeight: 1.15 }}>
              <div style={{ fontWeight: 700 }}>{u.name}</div>
              <div className="muted" style={{ fontSize: "var(--fs-14)" }}>
                {u.teamRole ?? (u.role === "manager" ? "Workshop Manager" : "Director")}
              </div>
            </div>
            <Avatar initials={u.initials} />
            <Btn
              kind="ghost"
              size="sm"
              aria-label="Sign out"
              style={{ minHeight: 44, minWidth: 44 }}
              onClick={() => {
                dispatch({ type: "signout" });
                go("/signin");
              }}
            >
              <SignOut size={20} weight="bold" />
            </Btn>
          </>
        )}
      </div>
    </header>
  );
}
