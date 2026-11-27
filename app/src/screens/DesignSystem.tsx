// The design system, as a page. Every component in every state, on the same
// canvas the app uses. It is part of the content: a reader should be able to
// see the whole language in one scroll.

import { ArrowRight, Check, Coffee, PencilSimpleLine, Plus, WarningCircle } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { STAGES, type Job } from "@/domain/domain";
import { JOBS, PEOPLE } from "@/domain/sample-data";
import {
  AvatarGroup,
  Avatar,
  Banner,
  BoardCard,
  Button,
  Chip,
  CutRow,
  Dialog,
  DialogActions,
  DialogBody,
  EmptyState,
  Field,
  Input,
  JobRow,
  MaterialStatusChip,
  Mark,
  PinPad,
  Section,
  Sheet,
  Skeleton,
  StageTrack,
  StaticToast,
  Textarea,
  TopBar,
  UrgencyChip,
  Wordmark,
  useToast,
} from "@/design-system";
import "./design-system.css";

const job = JOBS.find((j) => j.id === "J-1042")!;
const steve = PEOPLE.find((p) => p.id === "p-steve")!;
const tom = PEOPLE.find((p) => p.id === "p-tom")!;
const reviewJob: Job = { ...job, inDrawingReview: { raisedBy: "p-tom", note: "Back panel height?", at: new Date().toISOString() } };
const newJob = JOBS.find((j) => j.id === "J-1045")!;

const SECTIONS = [
  ["tokens", "Tokens"],
  ["type", "Type"],
  ["buttons", "Buttons"],
  ["chips", "Chips"],
  ["avatars", "Avatars"],
  ["track", "Stage track"],
  ["cards", "Job cards"],
  ["banners", "Banners"],
  ["fields", "Fields"],
  ["pin", "PIN pad"],
  ["overlays", "Sheet, dialog, toast"],
  ["empty", "Empty and error"],
  ["skeleton", "Skeleton"],
  ["topbar", "Top bar"],
] as const;

export function DesignSystem() {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState<"gate" | "conflict" | null>(null);
  const { toast } = useToast();

  return (
    <div className="ds">
      <aside className="ds__nav">
        <Link to="/signin" className="ds__home" aria-label="Arris sign-in">
          <Wordmark size={26} />
        </Link>
        <p className="ds__lede">The design system. One family, one accent, tokens in one place, every component in every state.</p>
        <nav aria-label="Sections">
          <ul>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="ds__main">
        <header className="ds__head">
          <h1 className="t-display">Arris design system</h1>
          <p className="t-body-lg t-muted">
            The canvas is a cool grey room; each card and sheet is a pale surface laid on it. Instrument Sans does the whole hierarchy. The accent is the colour of oak under oil, spent on the primary action, the current stage and the focus ring, and nowhere else. On the floor, calm never means small: nothing a joiner reads is under 16 px, and nothing is paler than ink-2.
          </p>
        </header>

        <Block id="tokens" title="Tokens" note="Colour, type scale, spacing, radius, elevation and motion are CSS variables in tokens.css. Components use them by name and never a raw value.">
          <div className="ds__swatches">
            {[
              ["--c-canvas", "Canvas"], ["--c-surface", "Surface"], ["--c-surface-2", "Surface 2"], ["--c-surface-3", "Surface 3"], ["--c-line", "Line"], ["--c-line-strong", "Line strong"],
              ["--c-ink", "Ink"], ["--c-ink-2", "Ink 2"], ["--c-ink-3", "Ink 3"], ["--c-accent", "Accent"], ["--c-accent-tint", "Accent tint"], ["--c-accent-line", "Accent line"],
              ["--c-overdue", "Overdue"], ["--c-overdue-tint", "Overdue tint"], ["--c-today", "Today"], ["--c-today-tint", "Today tint"], ["--c-ok", "OK"], ["--c-ok-tint", "OK tint"], ["--c-info", "Info"], ["--c-info-tint", "Info tint"],
            ].map(([v, label]) => (
              <div key={v} className="ds__swatch">
                <span className="ds__swatch-chip" style={{ background: `var(${v})` }} />
                <span className="ds__swatch-name">{label}</span>
                <code className="ds__code">{v}</code>
              </div>
            ))}
          </div>
          <div className="ds__row ds__row--wrap">
            <div className="ds__spec">
              <h3 className="t-heading">Radius</h3>
              <div className="ds__radii">
                {[["--r-sm", "8"], ["--r-md", "12"], ["--r-lg", "16"], ["--r-xl", "22"], ["--r-pill", "pill"]].map(([v, l]) => (
                  <div key={v} className="ds__radius" style={{ borderRadius: `var(${v})` }}>
                    <code className="ds__code">{l}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="ds__spec">
              <h3 className="t-heading">Elevation</h3>
              <div className="ds__shadows">
                {["--e-0", "--e-1", "--e-2", "--e-3"].map((v) => (
                  <div key={v} className="ds__shadow" style={{ boxShadow: `var(${v})` }}>
                    <code className="ds__code">{v}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="ds__spec">
              <h3 className="t-heading">Spacing</h3>
              <div className="ds__spaces">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                  <div key={n} className="ds__space">
                    <span style={{ width: `var(--s-${n})` }} />
                    <code className="ds__code">--s-{n}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="ds__spec">
              <h3 className="t-heading">Motion</h3>
              <ul className="ds__list">
                <li><code className="ds__code">--d-press</code> 120 ms, press feedback</li>
                <li><code className="ds__code">--d-fast</code> 160 ms, hover and colour</li>
                <li><code className="ds__code">--d-base</code> 220 ms, state changes</li>
                <li><code className="ds__code">--ease-out</code> cubic-bezier(0.23, 1, 0.32, 1)</li>
                <li>Springs: duration 0.4 to 0.55 s, bounce 0, or 0.08 to 0.12 where momentum was involved</li>
                <li>Reduced motion keeps opacity, drops every transform</li>
              </ul>
            </div>
          </div>
        </Block>

        <Block id="type" title="Type" note="Instrument Sans, variable weight and width. Display 40, title 26, heading 20, body 16 to 18 on the floor, 13 to 14 on the board. Tabular numerals everywhere.">
          <div className="ds__type">
            <p className="t-display">Reception desk with back panel</p>
            <p className="t-title">Who's working?</p>
            <p className="t-heading">Coming to the bench</p>
            <p className="t-body-lg">Tap your name, then your four-digit PIN. This tablet stays signed in as the workshop.</p>
            <p className="t-body">18mm oak veneered MDF, 4 sheets, Brackenfold Timber.</p>
            <p className="t-small t-muted">Approved 5 Oct by Steve. 2.5 MB</p>
            <p className="t-body" style={{ fontStretch: "88%" }}>Width 88%: the stage track uses the width axis so "Materials" and "Delivered" stay whole at 16 px.</p>
          </div>
        </Block>

        <Block id="buttons" title="Buttons" note="One primary per screen. Press feedback is a 2.5% scale on pointer-down. Busy shows a spinner in place of the icon and keeps the label, so the button never changes width.">
          {(["primary", "secondary", "ghost", "quiet", "danger"] as const).map((v) => (
            <div key={v} className="ds__row">
              <span className="ds__label">{v}</span>
              <Button variant={v} size="lg" icon={<Check size={26} weight="bold" />}>Bench work done</Button>
              <Button variant={v} size="md">Open job</Button>
              <Button variant={v} size="sm">Reset PIN</Button>
              <Button variant={v} size="md" busy>Sending</Button>
              <Button variant={v} size="md" disabled>Disabled</Button>
            </div>
          ))}
          <div className="ds__row">
            <span className="ds__label">block</span>
            <div style={{ width: 360 }}>
              <Button variant="primary" size="lg" block icon={<Check size={26} weight="bold" />}>Sign off QC</Button>
            </div>
          </div>
        </Block>

        <Block id="chips" title="Chips" note="Urgency is derived from the target date, never set by hand. Material status has its own shape so it can sit at the end of a row.">
          <div className="ds__row ds__row--wrap">
            <UrgencyChip urgency="overdue">2 days overdue</UrgencyChip>
            <UrgencyChip urgency="today">Due today</UrgencyChip>
            <UrgencyChip urgency="soon">Due in 2 days</UrgencyChip>
            <UrgencyChip urgency="on-track">Due in 10 days</UrgencyChip>
            <UrgencyChip urgency="overdue" size="lg">Large</UrgencyChip>
            <UrgencyChip urgency="soon" size="sm">Small</UrgencyChip>
          </div>
          <div className="ds__row ds__row--wrap">
            <Chip tone="neutral">Awaiting Materials</Chip>
            <Chip tone="accent">Manager</Chip>
            <Chip tone="ok">Synced</Chip>
            <Chip tone="info">Director</Chip>
            <Chip tone="warn">3 not in stock</Chip>
            <Chip tone="overdue">Urgent</Chip>
            <Chip tone="offline">Offline, 2 to send</Chip>
            <Chip tone="outline">Rev C</Chip>
          </div>
          <div className="ds__row ds__row--wrap">
            {(["required", "ordered", "stock", "issued", "complete"] as const).map((s) => (
              <MaterialStatusChip key={s} status={s} />
            ))}
          </div>
        </Block>

        <Block id="avatars" title="Avatars" note="Initials are 0.36 of the circle with no tracking and a slightly narrow width, so they never touch the edge. In a group each later avatar overlaps by 0.18 of the size with a ring of the surface; past the maximum the rest become a count. This is the second carry-over from the design review: on the board, 24 px avatars overlapping by 8 px clipped the initials.">
          <div className="ds__row ds__row--wrap">
            {[24, 26, 30, 36, 44, 52].map((s) => (
              <div key={s} className="ds__stack">
                <Avatar person={tom} size={s} />
                <code className="ds__code">{s}</code>
              </div>
            ))}
            <Avatar person={steve} size={36} tone="accent" />
            <Avatar person={steve} size={36} tone="ink" />
          </div>
          <div className="ds__row ds__row--wrap">
            {[24, 26, 30, 36].map((s) => (
              <div key={s} className="ds__stack">
                <AvatarGroup people={PEOPLE.slice(2, 5)} size={s} />
                <code className="ds__code">group {s}</code>
              </div>
            ))}
            <div className="ds__stack">
              <AvatarGroup people={PEOPLE.slice(2, 9)} size={30} max={4} />
              <code className="ds__code">seven people, max 4</code>
            </div>
            <div className="ds__stack">
              <AvatarGroup people={PEOPLE.slice(4, 6)} size={36} names="Tom and Sean" />
              <code className="ds__code">with names</code>
            </div>
          </div>
        </Block>

        <Block id="track" title="Stage track" note="The first carry-over from the design review. Labels are never paler than ink-2 and never truncated. At 16 px the width axis keeps every short label whole in the hero's eight columns; when the track is narrower than 580 px (a phone, a dense card) a container query drops the labels and shows the current stage, large, with what comes next. The marker is a shared-layout element, so it slides with a spring when the job moves.">
          <div className="ds__track">
            <span className="ds__label">lg, hours, job page</span>
            <StageTrack job={job} size="lg" showHours />
          </div>
          <div className="ds__track">
            <span className="ds__label">lg, locked at New (no drawing)</span>
            <StageTrack job={newJob} size="lg" locked showHours />
          </div>
          <div className="ds__track">
            <span className="ds__label">lg, in Drawing Review</span>
            <StageTrack job={reviewJob} size="lg" raisedBy="Tom" />
          </div>
          <div className="ds__track">
            <span className="ds__label">md, hero card</span>
            <StageTrack job={job} size="md" />
          </div>
          <div className="ds__track" style={{ maxWidth: 420 }}>
            <span className="ds__label">md in a 420 px container: the now line</span>
            <StageTrack job={job} size="md" />
          </div>
          <div className="ds__track" style={{ maxWidth: 360 }}>
            <span className="ds__label">sm, always the now line</span>
            <StageTrack job={{ ...job, stage: "qc" }} size="sm" />
          </div>
        </Block>

        <Block id="cards" title="Job cards" note="A row for floor lists at 20 px, a dense card for the board at 14 px. Both link to the job.">
          <ul className="ds__rows">
            <JobRow job={job} people={PEOPLE} me="p-tom" layout={false} />
            <JobRow job={JOBS[4]!} people={PEOPLE} me="p-tom" layout={false} note="Bench Work done at 09:40. Now in Spray Booth" />
          </ul>
          <ul className="ds__bcards">
            {STAGES.slice(1, 5).map((s, i) => (
              <BoardCard key={s.id} job={JOBS[i + 1]!} people={PEOPLE} stage={JOBS[i + 1]!.stage} />
            ))}
          </ul>
          <ul className="cuts" style={{ maxWidth: 720 }}>
            <CutRow cut={job.cuts[3]!} onAdvance={() => toast("Tap advances the status")} onFlag={() => toast("Flagged")} />
            <CutRow cut={job.cuts[0]!} onAdvance={() => undefined} onFlag={() => undefined} />
            <CutRow cut={{ ...job.cuts[4]!, status: "issue" }} onAdvance={() => undefined} onFlag={() => undefined} />
          </ul>
        </Block>

        <Block id="banners" title="Banners" note="Inline notices, where the person is. Error has role alert; the rest are status. Each tone's text is tinted from its hue, never grey.">
          <div className="ds__banners">
            <Banner tone="offline">You're offline. Anything you do here is kept on this tablet and sent when the signal comes back.</Banner>
            <Banner tone="block" title="No approved drawing yet." actions={<><Button size="md" variant="secondary">Switch person</Button><Button size="md" variant="ghost">Dismiss</Button></>}>This job stays in New until one is uploaded, so nobody builds from a sketch.</Banner>
            <Banner tone="review">Waiting on a revised drawing. Steve has your query.</Banner>
            <Banner tone="error" title="The query didn't send.">The tablet lost the connection halfway through. Your note and photo are kept here.</Banner>
            <Banner tone="warn" title="2 items aren't in stock yet.">CNC can start, but the machinists may end up waiting.</Banner>
            <Banner tone="info">Read only. Directors can see every job but not change it.</Banner>
            <Banner tone="ok">Everything is moving.</Banner>
          </div>
        </Block>

        <Block id="fields" title="Fields" note="Label above, hint below, error below that, all wired by id. Focus is the accent with a soft tint, not the browser's blue.">
          <div className="ds__fields">
            <Field label="Email" hint="Office sign-in only">{(a) => <Input {...a} type="email" defaultValue="steve@arris.example" />}</Field>
            <Field label="Password" error="That email and password didn't match. Check both and try again.">{(a) => <Input {...a} type="password" defaultValue="hunter2" invalid />}</Field>
            <Field label="Disabled">{(a) => <Input {...a} defaultValue="Not editable" disabled />}</Field>
            <Field label="What's wrong, or unclear?">{(a) => <Textarea {...a} rows={3} placeholder="Say what you see on the drawing and what you see on the bench." />}</Field>
          </div>
        </Block>

        <Block id="pin" title="PIN pad" note="Keys respond on pointer-down. A wrong PIN shakes the dots, says why, and clears. Try 1234, or anything else.">
          <div className="ds__row ds__row--wrap" style={{ alignItems: "flex-start", gap: "var(--s-10)" }}>
            <PinPad hint="Sample workshop PIN is 1234" onComplete={(pin) => (pin === "1234" ? (toast("Signed in"), null) : "That PIN didn't match. Try again, or ask Steve to reset it.")} />
            <PinPad initialError="That PIN didn't match. The PIN is now locked. Ask Steve to reset it." disabled onComplete={() => null} />
          </div>
        </Block>

        <Block id="overlays" title="Sheet, dialog, toast" note="A sheet springs up from the bottom and can be flicked away. A dialog is for decisions that need protected focus (gates, conflicts) and stays centred. A toast sits under the top bar, swipes up to dismiss, and carries Undo.">
          <div className="ds__row ds__row--wrap">
            <Button variant="secondary" size="md" icon={<PencilSimpleLine size={20} />} onClick={() => setSheet(true)}>Open a sheet</Button>
            <Button variant="secondary" size="md" onClick={() => setDialog("gate")}>Gate dialog</Button>
            <Button variant="secondary" size="md" onClick={() => setDialog("conflict")}>Conflict dialog</Button>
            <Button variant="secondary" size="md" onClick={() => toast("J-1042 passed to Spray Booth", { action: { label: "Undo", onClick: () => toast("Back in Bench Work") } })}>Toast with undo</Button>
            <Button variant="secondary" size="md" onClick={() => toast("J-1042 wasn't moved. The tablet lost the connection.", { tone: "error", action: { label: "Try again", onClick: () => undefined } })}>Error toast</Button>
          </div>
          <div className="ds__row ds__row--wrap">
            <StaticToast text="J-1042 passed to Spray Booth" action="Undo" />
            <StaticToast text="J-1042 wasn't moved. The tablet lost the connection." action="Try again" tone="error" />
          </div>
        </Block>

        <Block id="empty" title="Empty and error" note="Nothing here, said properly: what the space is for and what fills it. An error always has a way out and says what was kept.">
          <div className="ds__row ds__row--wrap" style={{ alignItems: "stretch" }}>
            <EmptyState icon={<Coffee size={30} weight="bold" />} title="Nothing waiting at the bench" actions={<Button variant="secondary" size="lg" icon={<ArrowRight size={22} />}>See the board</Button>}>
              When Steve assigns you a job, or one arrives at Bench Work, it will appear here.
            </EmptyState>
            <EmptyState tone="error" icon={<WarningCircle size={30} weight="bold" />} title="Couldn't load your jobs" actions={<Button variant="primary" size="lg">Try again</Button>}>
              Couldn't reach the workshop server. Nothing you've done has been lost; the tablet keeps what it had.
            </EmptyState>
          </div>
        </Block>

        <Block id="skeleton" title="Skeleton" note="Loading matches the final layout's shape. Shimmer is linear; under reduced motion it holds still.">
          <div className="hero hero--skeleton" style={{ maxWidth: 640 }}>
            <div className="hero__top"><Skeleton w={200} h={22} /><Skeleton w={120} h={36} r={999} /></div>
            <Skeleton w="70%" h={44} r={10} />
            <Skeleton w={240} h={26} />
            <div className="sk-track">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={8} r={4} />)}</div>
            <div className="hero__actions"><Skeleton w={260} h={64} r={16} /><Skeleton w={160} h={64} r={16} /></div>
          </div>
        </Block>

        <Block id="topbar" title="Top bar and wordmark" note="A translucent layer the page scrolls beneath. Floor and office variants, with the offline and sending states.">
          <div className="ds__bars">
            <div className="ds__bar"><TopBar person={tom} /></div>
            <div className="ds__bar"><TopBar person={tom} online={false} pending={2} back="/jobs" title="J-1042" /></div>
            <div className="ds__bar"><TopBar person={steve} dense title="Board" pending={1} nav={[{ to: "/today", label: "Today" }, { to: "/board", label: "Board" }, { to: "/settings", label: "People" }]} /></div>
          </div>
          <div className="ds__row ds__row--wrap">
            <Wordmark size={40} />
            <Wordmark size={24} />
            <Mark size={64} />
            <span className="ds__icon-tile"><Mark size={40} /></span>
          </div>
        </Block>
      </main>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Raise a drawing query" description="J-1042 goes to Drawing Review until Steve answers." wide>
        <div className="query">
          <Field label="What's wrong, or unclear?">{(a) => <Textarea {...a} rows={3} placeholder="Say what you see on the drawing and what you see on the bench." />}</Field>
          <div className="query__actions">
            <Button variant="primary" size="lg" onClick={() => setSheet(false)}>Send to Drawing Review</Button>
            <Button variant="ghost" size="lg" onClick={() => setSheet(false)}>Cancel</Button>
          </div>
        </div>
      </Sheet>

      <Dialog open={dialog === "gate"} onClose={() => setDialog(null)} title="This job needs an approved drawing first" tone="block">
        <DialogBody>J-1045 has no drawing yet. Jobs can't leave New until a drawing is approved and stored, so the floor never builds from a sketch or a phone photo.</DialogBody>
        <DialogActions>
          <Button variant="primary" size="lg" icon={<Plus size={22} />} onClick={() => setDialog(null)}>Upload drawing</Button>
          <Button variant="ghost" size="lg" onClick={() => setDialog(null)}>Not now</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "conflict"} onClose={() => setDialog(null)} title="Tom changed this job on the bench tablet 2 minutes ago" tone="warn" dismissable={false}>
        <DialogBody>While you were on this page, Tom marked Bench Work done and passed J-1042 to Spray Booth. You moved it to Quality Check. Both are kept in the history, but the job can only be in one place.</DialogBody>
        <div className="conflict">
          <div className="conflict__opt"><span className="conflict__who">Tom, bench tablet</span><span className="conflict__val">Spray Booth</span><span className="t-small t-muted">2 minutes ago</span></div>
          <div className="conflict__opt"><span className="conflict__who">You, office laptop</span><span className="conflict__val">Quality Check</span><span className="t-small t-muted">Just now</span></div>
        </div>
        <DialogActions>
          <Button variant="primary" size="lg" onClick={() => setDialog(null)}>Keep Tom's change</Button>
          <Button variant="secondary" size="lg" onClick={() => setDialog(null)}>Use mine</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function Block({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="ds__block" id={id} aria-label={title}>
      <Section title={title}>
        <p className="ds__note">{note}</p>
        <div className="ds__body">{children}</div>
      </Section>
    </section>
  );
}
