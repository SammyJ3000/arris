// A simple technical drawing of the J-1042 reception desk, drawn as SVG for the
// prototype. The real app shows the PDF. Opening it draws the outlines, then the
// dimension lines, in the order a draughtsman would ink them.

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cloudPath } from "../components/primitives";

const S = 0.2; // px per mm
const INK = "var(--ink)";
const DIM = "var(--blue)";
const HAIR = 0.9;
const OUTLINE = 1.8;

export function ReceptionDesk({ rev, drawn }: { rev: "B" | "C"; drawn: boolean }) {
  const reduce = useReducedMotion();
  const animate = drawn && !reduce;
  const draw = (delay: number, dur = 0.7) =>
    animate
      ? {
          initial: { pathLength: 0, opacity: 1 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration: dur, delay, ease: [0.77, 0, 0.175, 1] as [number, number, number, number] },
        }
      : {};
  const fade = (delay: number) =>
    animate ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } } : {};

  // Front elevation, public side
  const fx = 70, base = 560;
  const bpW = 2400 * S, bpH = 2100 * S, dkH = 1100 * S;
  const bpTop = base - bpH, dkTop = base - dkH;
  // Rear elevation, staff side
  const rx = 640;
  const drawerW = (rev === "C" ? 396 : 400) * S;
  const drawerH = 180 * S;
  const drawerTop = dkTop + 40 * S;

  return (
    <svg className="dwg" viewBox="0 0 1188 840" role="img" aria-label={`Drawing HLH-RD-01 revision ${rev}, reception desk with back panel, front and rear elevations and plan`}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="0.5" opacity="0.5" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0 1.5 L10 5 L0 8.5 Z" fill={DIM} />
        </marker>
        <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0 1.5 L10 5 L0 8.5 Z" fill={INK} />
        </marker>
      </defs>

      {/* Sheet */}
      <rect x="0" y="0" width="1188" height="840" fill="var(--sheet)" />
      <rect x="18" y="18" width="1152" height="804" fill="none" stroke={INK} strokeWidth="1.6" />
      <rect x="26" y="26" width="1136" height="788" fill="none" stroke={INK} strokeWidth="0.6" />

      {/* General notes */}
      <g className="dwg__text" fill={INK}>
        <text x="44" y="52" fontSize="11" fontWeight="600">
          GENERAL NOTES
        </text>
        <text x="44" y="68" fontSize="10">
          1. ALL DIMENSIONS IN MILLIMETRES. DO NOT SCALE FROM THIS DRAWING.
        </text>
        <text x="44" y="82" fontSize="10">
          2. CHECK ALL DIMENSIONS ON SITE BEFORE MANUFACTURE.
        </text>
        <text x="44" y="96" fontSize="10">
          3. VENEER TO BE BOOK MATCHED ACROSS FRONT PANELS. GRAIN VERTICAL.
        </text>
      </g>

      {/* Revision table */}
      <g fill={INK}>
        <rect x="860" y="40" width="308" height={rev === "C" ? 84 : 66} fill="none" stroke={INK} strokeWidth="0.8" />
        <line x1="860" y1="58" x2="1168" y2="58" stroke={INK} strokeWidth="0.8" />
        <line x1="892" y1="40" x2="892" y2={rev === "C" ? 124 : 106} stroke={INK} strokeWidth="0.8" />
        <line x1="948" y1="40" x2="948" y2={rev === "C" ? 124 : 106} stroke={INK} strokeWidth="0.8" />
        <text x="866" y="53" fontSize="9" fontWeight="600">
          REV
        </text>
        <text x="898" y="53" fontSize="9" fontWeight="600">
          DATE
        </text>
        <text x="954" y="53" fontSize="9" fontWeight="600">
          DESCRIPTION
        </text>
        <RevRow y={72} rev="A" date="22 SEP" text="ISSUED FOR CLIENT APPROVAL" />
        <RevRow y={90} rev="B" date="02 OCT" text="SOFT-CLOSE RUNNERS. SHELF DEPTH 380" />
        {rev === "C" && <RevRow y={108} rev="C" date="05 OCT" text="DRAWER FRONTS 396 WIDE, 6 NO. CLOUDED" current />}
      </g>

      {/* FRONT ELEVATION */}
      <g>
        <motion.rect x={fx} y={bpTop} width={bpW} height={bpH - dkH} fill="none" stroke={INK} strokeWidth={OUTLINE} {...draw(0.05)} />
        <motion.line x1={fx + bpW / 2} y1={bpTop} x2={fx + bpW / 2} y2={dkTop} stroke={INK} strokeWidth={HAIR} {...draw(0.3, 0.4)} />
        <motion.rect x={fx} y={dkTop} width={bpW} height={dkH} fill="none" stroke={INK} strokeWidth={OUTLINE} {...draw(0.15)} />
        {/* three front panels */}
        {[1, 2].map((i) => (
          <motion.line key={i} x1={fx + (bpW / 3) * i} y1={dkTop} x2={fx + (bpW / 3) * i} y2={base} stroke={INK} strokeWidth={HAIR} {...draw(0.35, 0.4)} />
        ))}
        {/* desk top overhang */}
        <motion.rect x={fx - 8} y={dkTop - 6} width={bpW + 16} height={6} fill="url(#hatch)" stroke={INK} strokeWidth={HAIR} {...draw(0.3, 0.4)} />
        {/* plinth */}
        <motion.line x1={fx} y1={base - 60 * S} x2={fx + bpW} y2={base - 60 * S} stroke={INK} strokeWidth={HAIR} strokeDasharray="4 3" {...draw(0.4, 0.4)} />
        <motion.text x={fx} y={base + 36} fontSize="12" fontWeight="600" fill={INK} {...fade(0.5)}>
          FRONT ELEVATION
        </motion.text>
        <motion.text x={fx + 128} y={base + 36} fontSize="10" fill={INK} {...fade(0.5)}>
          SCALE 1:20
        </motion.text>

        {/* dims */}
        <DimH x1={fx} x2={fx + bpW} y={base + 56} text="2400" d={0.7} draw={draw} fade={fade} />
        <DimV x={fx - 28} y1={dkTop} y2={base} text="1100" d={0.8} draw={draw} fade={fade} />
        <DimV x={fx - 54} y1={bpTop} y2={base} text="2100" d={0.9} draw={draw} fade={fade} />
        <DimH x1={fx} x2={fx + bpW / 3} y={dkTop - 22} text="800" d={1.0} draw={draw} fade={fade} />
      </g>

      {/* REAR ELEVATION */}
      <g>
        <motion.rect x={rx} y={bpTop} width={bpW} height={bpH} fill="none" stroke={INK} strokeWidth={OUTLINE} {...draw(0.1)} />
        <motion.line x1={rx} y1={dkTop} x2={rx + bpW} y2={dkTop} stroke={INK} strokeWidth={OUTLINE} {...draw(0.2, 0.5)} />
        {/* carcass sides */}
        {[0, 1, 2, 3].map((i) => (
          <motion.line key={i} x1={rx + 18 * S + i * 790 * S} y1={dkTop} x2={rx + 18 * S + i * 790 * S} y2={base} stroke={INK} strokeWidth={HAIR} {...draw(0.3, 0.4)} />
        ))}
        {/* shelves */}
        {[0, 1].map((i) => (
          <motion.line key={i} x1={rx} y1={drawerTop + drawerH + 40 * S + i * 280 * S} x2={rx + bpW} y2={drawerTop + drawerH + 40 * S + i * 280 * S} stroke={INK} strokeWidth={HAIR} {...draw(0.4, 0.4)} />
        ))}
        {/* drawers */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const gap = (bpW - 6 * drawerW) / 7;
          const x = rx + gap + i * (drawerW + gap);
          return (
            <g key={i}>
              <motion.rect x={x} y={drawerTop} width={drawerW} height={drawerH} fill="none" stroke={INK} strokeWidth={HAIR} {...draw(0.45 + i * 0.03, 0.35)} />
              <motion.line x1={x + drawerW / 2 - 8} y1={drawerTop + drawerH / 2} x2={x + drawerW / 2 + 8} y2={drawerTop + drawerH / 2} stroke={INK} strokeWidth={OUTLINE} {...draw(0.6, 0.2)} />
            </g>
          );
        })}
        <motion.text x={rx} y={base + 36} fontSize="12" fontWeight="600" fill={INK} {...fade(0.5)}>
          REAR ELEVATION (STAFF SIDE)
        </motion.text>
        <motion.text x={rx + 196} y={base + 36} fontSize="10" fill={INK} {...fade(0.5)}>
          SCALE 1:20
        </motion.text>

        {/* dims */}
        {(() => {
          const gap = (bpW - 6 * drawerW) / 7;
          const x0 = rx + gap;
          return (
            <>
              <DimH x1={x0} x2={x0 + drawerW} y={drawerTop - 20} text={rev === "C" ? "396" : "400"} d={1.05} draw={draw} fade={fade} />
              <DimH x1={x0} x2={x0 + 5 * (drawerW + gap) + drawerW} y={drawerTop - 44} text={`6 NO. DRAWER FRONTS @ ${rev === "C" ? "396" : "400"}`} d={1.15} draw={draw} fade={fade} />
              <DimV x={rx + bpW + 28} y1={drawerTop} y2={drawerTop + drawerH} text="180" d={1.2} draw={draw} fade={fade} />
              <DimV x={rx + bpW + 54} y1={bpTop} y2={base} text="2100" d={1.25} draw={draw} fade={fade} />
              {rev === "C" && (
                <motion.g {...fade(1.4)}>
                  <path d={cloud(x0 - 16, drawerTop - 58, 5 * (drawerW + gap) + drawerW + 32, drawerH + 72, 16)} fill="none" stroke={DIM} strokeWidth="1.3" />
                  <g transform={`translate(${x0 + 5 * (drawerW + gap) + drawerW + 22} ${drawerTop - 62})`}>
                    <path d="M10 0 L20 18 H0 Z" fill="var(--sheet)" stroke={DIM} strokeWidth="1.4" strokeLinejoin="round" />
                    <text x="10" y="15" fontSize="10" fontWeight="600" textAnchor="middle" fill={DIM}>
                      C
                    </text>
                  </g>
                </motion.g>
              )}
            </>
          );
        })()}
      </g>

      {/* PLAN */}
      <g>
        <motion.rect x={fx} y={620} width={bpW} height={800 * S} fill="none" stroke={INK} strokeWidth={OUTLINE} {...draw(0.25)} />
        <motion.line x1={fx} y1={620 + 100 * S} x2={fx + bpW} y2={620 + 100 * S} stroke={INK} strokeWidth={HAIR} {...draw(0.4, 0.4)} />
        <motion.rect x={fx} y={620 - 18 * S} width={bpW} height={18 * S} fill="url(#hatch)" stroke={INK} strokeWidth={HAIR} {...draw(0.4, 0.4)} />
        <motion.text x={fx} y={620 + 800 * S + 24} fontSize="12" fontWeight="600" fill={INK} {...fade(0.5)}>
          PLAN
        </motion.text>
        <motion.text x={fx + 40} y={620 + 800 * S + 24} fontSize="10" fill={INK} {...fade(0.5)}>
          SCALE 1:20
        </motion.text>
        <DimV x={fx + bpW + 28} y1={620} y2={620 + 800 * S} text="800" d={1.1} draw={draw} fade={fade} />
        <DimV x={fx + bpW + 28} y1={620 - 18 * S} y2={620} text="18" d={1.15} draw={draw} fade={fade} small />
      </g>

      {/* Title block */}
      <g>
        <rect x="700" y="648" width="468" height="166" fill="var(--sheet)" stroke={INK} strokeWidth="1.2" />
        <line x1="700" y1="690" x2="1168" y2="690" stroke={INK} strokeWidth="0.8" />
        <line x1="700" y1="740" x2="1168" y2="740" stroke={INK} strokeWidth="0.8" />
        <line x1="700" y1="778" x2="1168" y2="778" stroke={INK} strokeWidth="0.8" />
        <line x1="960" y1="690" x2="960" y2="814" stroke={INK} strokeWidth="0.8" />
        <line x1="1064" y1="740" x2="1064" y2="814" stroke={INK} strokeWidth="0.8" />
        <g fill={INK}>
          <TB x={708} y={660} label="CLIENT" value="HARBOUR LANE HOTEL" big />
          <TB x={708} y={700} label="PROJECT" value="RECEPTION DESK WITH BACK PANEL" />
          <TB x={968} y={700} label="DRAWING" value="FRONT AND REAR ELEVATIONS, PLAN" />
          <TB x={708} y={750} label="JOB NO" value="J-1042" mono />
          <TB x={820} y={750} label="DRG NO" value="HLH-RD-01" mono />
          <TB x={968} y={750} label="SCALE" value="1:20 @ A3" mono />
          <TB x={1072} y={750} label="DATE" value="05 OCT 2026" mono />
          <TB x={708} y={788} label="DRAWN" value="SM" mono />
          <TB x={820} y={788} label="CHECKED" value="HC" mono />
          <TB x={968} y={788} label="STATUS" value={rev === "C" ? "APPROVED FOR MANUFACTURE" : "SUPERSEDED"} />
        </g>
        {/* Rev box */}
        <rect x="1072" y="781" width="88" height="28" fill={rev === "C" ? "var(--blue-wash)" : "none"} stroke={rev === "C" ? DIM : INK} strokeWidth="1.2" />
        <text x="1080" y="792" fontSize="7" fill={INK}>
          REV
        </text>
        <text x="1116" y="803" fontSize="16" fontWeight="600" textAnchor="middle" fill={rev === "C" ? DIM : INK} fontFamily="var(--font-mono)">
          {rev}
        </text>
      </g>

      {/* Approval stamp on current rev */}
      {rev === "C" && (
        <motion.g transform="translate(560 650) rotate(-6)" {...fade(animate ? 1.6 : 0)}>
          <rect x="0" y="0" width="150" height="64" fill="none" stroke={DIM} strokeWidth="2" rx="2" />
          <rect x="5" y="5" width="140" height="54" fill="none" stroke={DIM} strokeWidth="0.8" rx="1" />
          <text x="75" y="26" fontSize="15" fontWeight="700" textAnchor="middle" fill={DIM} letterSpacing="1.5">
            APPROVED
          </text>
          <text x="75" y="41" fontSize="8" textAnchor="middle" fill={DIM}>
            FOR MANUFACTURE
          </text>
          <text x="75" y="53" fontSize="7.5" textAnchor="middle" fill={DIM} fontFamily="var(--font-mono)">
            REV C 05 OCT 2026 SM
          </text>
        </motion.g>
      )}

      {/* Superseded watermark */}
      {rev === "B" && (
        <g transform="translate(594 420) rotate(-22)" opacity="0.85">
          <text x="0" y="0" fontSize="92" fontWeight="700" textAnchor="middle" fill="none" stroke="var(--red)" strokeWidth="2.2" letterSpacing="6">
            SUPERSEDED
          </text>
          <text x="0" y="40" fontSize="18" textAnchor="middle" fill="var(--red)" fontFamily="var(--font-mono)">
            REPLACED BY REV C, 05 OCT 2026
          </text>
        </g>
      )}
    </svg>
  );
}

type DrawFn = (delay: number, dur?: number) => object;
type FadeFn = (delay: number) => object;

function DimH({ x1, x2, y, text, d, draw, fade }: { x1: number; x2: number; y: number; text: string; d: number; draw: DrawFn; fade: FadeFn }) {
  const mid = (x1 + x2) / 2;
  const up = y < 400;
  return (
    <g>
      <motion.line x1={x1} y1={y + (up ? 14 : -14)} x2={x1} y2={y + (up ? -4 : 4)} stroke={DIM} strokeWidth={HAIR} {...draw(d, 0.3)} />
      <motion.line x1={x2} y1={y + (up ? 14 : -14)} x2={x2} y2={y + (up ? -4 : 4)} stroke={DIM} strokeWidth={HAIR} {...draw(d, 0.3)} />
      <motion.line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM} strokeWidth={HAIR} markerStart="url(#arrow)" markerEnd="url(#arrow)" {...draw(d + 0.1, 0.4)} />
      <motion.text x={mid} y={y - 4} fontSize="10" textAnchor="middle" fill={DIM} fontFamily="var(--font-mono)" {...fade(d + 0.4)}>
        {text}
      </motion.text>
    </g>
  );
}

function DimV({ x, y1, y2, text, d, draw, fade, small = false }: { x: number; y1: number; y2: number; text: string; d: number; draw: DrawFn; fade: FadeFn; small?: boolean }) {
  const mid = (y1 + y2) / 2;
  const left = x < 600;
  return (
    <g>
      <motion.line x1={x + (left ? 14 : -14)} y1={y1} x2={x + (left ? -4 : 4)} y2={y1} stroke={DIM} strokeWidth={HAIR} {...draw(d, 0.3)} />
      <motion.line x1={x + (left ? 14 : -14)} y1={y2} x2={x + (left ? -4 : 4)} y2={y2} stroke={DIM} strokeWidth={HAIR} {...draw(d, 0.3)} />
      <motion.line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM} strokeWidth={HAIR} markerStart="url(#arrow)" markerEnd="url(#arrow)" {...draw(d + 0.1, 0.4)} />
      <motion.text
        x={x - 4}
        y={small ? y1 - 2 : mid}
        fontSize="10"
        textAnchor={small ? "start" : "middle"}
        fill={DIM}
        fontFamily="var(--font-mono)"
        transform={small ? undefined : `rotate(-90 ${x - 4} ${mid})`}
        {...fade(d + 0.4)}
      >
        {text}
      </motion.text>
    </g>
  );
}

function RevRow({ y, rev, date, text, current = false }: { y: number; rev: string; date: string; text: string; current?: boolean }) {
  return (
    <g fontSize="9" fill={current ? DIM : INK} fontWeight={current ? 600 : 400}>
      <text x="870" y={y} fontFamily="var(--font-mono)">
        {rev}
      </text>
      <text x="898" y={y} fontFamily="var(--font-mono)">
        {date}
      </text>
      <text x="954" y={y}>
        {text}
      </text>
    </g>
  );
}

function TB({ x, y, label, value, big = false, mono = false }: { x: number; y: number; label: string; value: string; big?: boolean; mono?: boolean }) {
  return (
    <g>
      <text x={x} y={y + 8} fontSize="7" opacity="0.75">
        {label}
      </text>
      <text x={x} y={y + (big ? 26 : 22)} fontSize={big ? 15 : 10.5} fontWeight={big ? 600 : 500} fontFamily={mono ? "var(--font-mono)" : undefined}>
        {value}
      </text>
    </g>
  );
}

function cloud(x: number, y: number, w: number, h: number, s: number): string {
  return cloudPath(w + 2 * s, h + 2 * s, s, x - s, y - s);
}

export function DrawingFrame({ children }: { children: ReactNode }) {
  return <div className="dwg-frame">{children}</div>;
}
