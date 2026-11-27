import type { ReactNode } from "react";

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id} aria-label={title}>
      <header className="section__head">
        <h2 className="t-heading">{title}</h2>
        {aside && <div className="section__aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
