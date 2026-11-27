import { ArrowRight, CheckCircle, ClipboardText, Package, PencilSimpleLine, Timer } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { usePeople, useSession, useToday } from "@/data";
import { urgency, type Job } from "@/domain/domain";
import { dueText, firstName, materialsNotReady, relativeTime, stageLabel } from "@/domain/helpers";
import { EmptyState, Skeleton, UrgencyChip } from "@/design-system";
import { AppTopBar, LoadError } from "./shell";

/** Only what needs the manager. The aim is a daily check in about five minutes. */
export function Today() {
  const today = useToday();
  const peopleQ = usePeople();
  const { session } = useSession();
  const people = peopleQ.status === "ready" ? peopleQ.data : [];
  const first = session?.person.name.split(" ")[0] ?? "";
  const dateLine = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page">
      <AppTopBar title="Today" />
      <main className="page__main today" aria-busy={today.status === "loading"}>
        <div className="today__head">
          <h1 className="t-display">{today.status === "ready" && today.data.clear ? `Nothing needs you, ${first}` : `Needs you, ${first}`}</h1>
          <p className="t-body-lg t-muted">{dateLine}</p>
        </div>

        {today.status === "loading" && (
          <div className="today__groups">
            {[3, 2, 1].map((n, i) => (
              <div key={i} className="today__group">
                <Skeleton w={220} h={24} />
                {Array.from({ length: n }).map((_, k) => (
                  <Skeleton key={k} h={72} r={16} />
                ))}
              </div>
            ))}
          </div>
        )}

        {today.status === "error" && <LoadError query={today} what="today's list" />}

        {today.status === "ready" && today.data.clear && (
          <div className="today__clear">
            <EmptyState icon={<CheckCircle size={30} weight="bold" />} title="Everything is moving">
              No open drawing queries, nothing held up on materials, nothing at risk of being late and nothing waiting for QC sign-off. The board has the full picture.
            </EmptyState>
          </div>
        )}

        {today.status === "ready" && !today.data.clear && (
          <div className="today__groups">
            <Group title="Drawing queries" count={today.data.queries.length} icon={<PencilSimpleLine size={22} />}>
              {today.data.queries.map((j) => (
                <Item key={j.id} job={j} sub={`${firstName(people, j.inDrawingReview!.raisedBy)} asked ${relativeTime(j.inDrawingReview!.at)}: "${j.inDrawingReview!.note}"`} />
              ))}
            </Group>
            <Group title="Materials holding jobs up" count={today.data.materialsHolding.length} icon={<Package size={22} />}>
              {today.data.materialsHolding.map(({ job, items }) => (
                <Item key={job.id} job={job} sub={`${items} ${items === 1 ? "item" : "items"} not in stock: ${materialsNotReady(job).map((m) => m.name).join(", ")}`} />
              ))}
            </Group>
            <Group title="At risk of being late" count={today.data.atRisk.length} icon={<Timer size={22} />}>
              {today.data.atRisk.map((j) => (
                <Item key={j.id} job={j} sub={`${stageLabel(j.stage)}${j.assigned.length ? `, with ${j.assigned.map((id) => firstName(people, id)).join(" and ")}` : ", nobody assigned"}`} />
              ))}
            </Group>
            <Group title="Waiting for QC sign-off" count={today.data.qcWaiting.length} icon={<ClipboardText size={22} />}>
              {today.data.qcWaiting.map((j) => (
                <Item key={j.id} job={j} sub={`${j.qc?.checked.length ?? 0} of 8 checks ticked`} />
              ))}
            </Group>
          </div>
        )}
      </main>
    </div>
  );
}

function Group({ title, count, icon, children }: { title: string; count: number; icon: ReactNode; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="today__group" aria-label={title}>
      <div className="today__group-head">
        {icon}
        <h2 className="t-heading">{title}</h2>
        <span className="today__count">{count}</span>
      </div>
      <ul className="today__list">{children}</ul>
    </section>
  );
}

function Item({ job, sub }: { job: Job; sub: string }) {
  return (
    <li>
      <Link className="today__item" to={`/job/${job.id}`}>
        <div className="today__item-main">
          <span className="today__item-title">
            {job.id}
            <span>{job.piece}</span>
          </span>
          <span className="today__item-sub">{sub}</span>
        </div>
        <div className="today__item-side">
          <UrgencyChip urgency={urgency(job)}>{dueText(job.targetDate)}</UrgencyChip>
          <ArrowRight size={20} className="jobrow__chev" />
        </div>
      </Link>
    </li>
  );
}
