import { ArrowLeft, ArrowsClockwise, WifiSlash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import type { Person } from "@/domain/domain";
import { Avatar } from "./Avatar";
import { Chip } from "./Chip";
import { Wordmark } from "./Wordmark";

export interface TopBarProps {
  title?: string;
  /** Where the back arrow goes. No arrow without it. */
  back?: string;
  actions?: ReactNode;
  dense?: boolean;
  person?: Person | null;
  online?: boolean;
  pending?: number;
  onSwitchPerson?: () => void;
  /** Office navigation, shown only to office roles. */
  nav?: { to: string; label: string }[];
}

/** A translucent layer the page scrolls beneath. */
export function TopBar({ title, back, actions, dense, person, online = true, pending = 0, onSwitchPerson, nav }: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header className={`topbar ${dense ? "topbar--dense" : ""}`}>
      <div className="topbar__in">
        <div className="topbar__left">
          {back ? (
            <button className="icon-btn" aria-label="Back" onClick={() => navigate(back)}>
              <ArrowLeft size={24} />
            </button>
          ) : (
            <Link to={person?.role === "operative" ? "/jobs" : person ? "/today" : "/signin"} aria-label="Arris home" className="topbar__home">
              <Wordmark size={dense ? 20 : 24} />
            </Link>
          )}
          {title && <span className="topbar__title">{title}</span>}
          {nav && nav.length > 0 && (
            <nav className="topbar__nav" aria-label="Office">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} className="topbar__navlink">
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
        <div className="topbar__right">
          {!online ? (
            <Chip tone="offline" icon={<WifiSlash size={16} weight="bold" />}>
              Offline{pending > 0 ? `, ${pending} to send` : ""}
            </Chip>
          ) : pending > 0 ? (
            <span className="topbar__sync">
              <ArrowsClockwise size={16} /> Sending {pending}
            </span>
          ) : null}
          {actions}
          {person && (
            <button className="person-chip" onClick={onSwitchPerson} title="Switch person">
              <Avatar person={person} size={dense ? 28 : 36} />
              <span className="person-chip__name">{person.name.split(" ")[0]}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
