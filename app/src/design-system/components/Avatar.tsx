import type { CSSProperties } from "react";
import type { Person } from "@/domain/domain";

type Tone = "neutral" | "accent" | "ink";

export function Avatar({ person, size = 36, tone = "neutral" }: { person: Pick<Person, "name" | "initials">; size?: number; tone?: Tone }) {
  return (
    <span className={`avatar ${tone !== "neutral" ? `avatar--${tone}` : ""}`} style={{ "--av": `${size}px` } as CSSProperties} title={person.name} aria-label={person.name} role="img">
      <span className="avatar__text" aria-hidden="true">
        {person.initials}
      </span>
    </span>
  );
}

/**
 * A row of people. Each later avatar overlaps the one before by a fraction of
 * the size, with a ring of the surface, so initials never get covered. Past
 * `max` the rest collapse into a count.
 */
export function AvatarGroup({ people, size = 32, max = 4, names }: { people: Person[]; size?: number; max?: number; names?: string }) {
  if (people.length === 0) return null;
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const rest = people.length - shown.length;
  return (
    <span className="avatar-group" role="group" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} />
      ))}
      {rest > 0 && (
        <span className="avatar avatar--more" style={{ "--av": `${size}px` } as CSSProperties} aria-hidden="true">
          <span className="avatar__text">+{rest}</span>
        </span>
      )}
      {names && <span className="avatar-group__names">{names}</span>}
    </span>
  );
}
