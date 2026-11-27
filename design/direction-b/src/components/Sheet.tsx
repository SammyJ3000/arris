// Every screen is a drawing sheet: a double border, a head strip for wayfinding and
// sync state, the content, and a title block along the bottom edge that carries the
// product mark, the sheet title, the signed-in person and the date.

import { ArrowLeft, CloudSlash, Check, ArrowsClockwise } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Cell, Wordmark } from "./primitives";
import { useStore, formatDateLong } from "../store";
import { daysFromToday } from "../shared/domain";
import { navigate } from "../router";
import { PrototypeMenu } from "./PrototypeMenu";

export function Sheet({
  title,
  sheetNo = "1 of 1",
  jobNo,
  rev,
  revSuperseded,
  back,
  backLabel = "Back",
  children,
  dense = false,
  headRight,
  className = "",
  scale,
}: {
  title: string;
  sheetNo?: string;
  jobNo?: string;
  rev?: string;
  revSuperseded?: boolean;
  back?: string;
  backLabel?: string;
  children: ReactNode;
  dense?: boolean;
  headRight?: ReactNode;
  className?: string;
  scale?: string;
}) {
  const { state } = useStore();
  return (
    <div className={`desk ${dense ? "desk--dense" : ""}`}>
      <div className={`sheet ${className}`}>
        <header className="sheet__head">
          <div className="sheet__head-left">
            {back ? (
              <button type="button" className="head-back" onClick={() => navigate(back)}>
                <ArrowLeft size={22} weight="regular" aria-hidden="true" />
                <span>{backLabel}</span>
              </button>
            ) : (
              <span className="head-title">{title}</span>
            )}
          </div>
          <div className="sheet__head-right">
            {headRight}
            <SyncStatus />
          </div>
        </header>
        <main className="sheet__body">{children}</main>
        <footer className="title-block" aria-label="Title block">
          <div className="tb-cell tb-cell--mark">
            <Wordmark size={dense ? 15 : 17} />
          </div>
          <Cell label="Sheet" className="tb-cell--title">
            {title}
          </Cell>
          {jobNo && (
            <Cell label="Job no" mono className="tb-cell--job">
              {jobNo}
            </Cell>
          )}
          {rev !== undefined && (
            <Cell label="Rev" mono className={`tb-cell--rev ${revSuperseded ? "is-superseded" : ""}`}>
              {rev || "-"}
            </Cell>
          )}
          {scale && (
            <Cell label="Scale" mono className="tb-cell--scale">
              {scale}
            </Cell>
          )}
          <Cell label={state.user?.role === "manager" ? "Office" : state.user?.role === "director" ? "Read only" : "On the floor"} className="tb-cell--who">
            {state.user ? state.user.name : "Workshop tablet"}
          </Cell>
          <Cell label="Date" mono className="tb-cell--date">
            {formatDateLong(daysFromToday(0))}
          </Cell>
          <Cell label="Sheet no" mono className="tb-cell--no">
            {sheetNo}
          </Cell>
        </footer>
      </div>
      <PrototypeMenu />
    </div>
  );
}

function SyncStatus() {
  const { state } = useStore();
  const [time, setTime] = useState(() => clock());
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (state.offline) {
    return (
      <div className="sync sync--offline" role="status">
        <CloudSlash size={20} weight="regular" aria-hidden="true" />
        <span>
          Offline. {state.pendingSync === 0 ? "Changes will be held on this tablet" : `${state.pendingSync} change${state.pendingSync === 1 ? "" : "s"} held on this tablet`}
        </span>
      </div>
    );
  }
  if (state.pendingSync > 0) {
    return (
      <div className="sync sync--syncing" role="status">
        <ArrowsClockwise size={18} weight="regular" aria-hidden="true" />
        <span>Syncing</span>
      </div>
    );
  }
  return (
    <div className="sync" role="status">
      <Check size={16} weight="bold" aria-hidden="true" />
      <span>
        Synced <span className="mono">{time}</span>
      </span>
    </div>
  );
}

function clock() {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
