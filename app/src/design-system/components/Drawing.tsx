// A simple technical drawing of the reception desk, rendered as SVG. The real
// app will show the stored PDF; this stands in so the viewer and the gate have
// something true to show. Revision B has the shorter back panel that C replaced.

const ink = "var(--c-ink)";
const thin = "var(--c-ink-2)";

function Dim({ x1, y1, x2, y2, label, offset = 0, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke={thin} strokeWidth={0.8} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} />
          <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} />
          <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} />
        </>
      )}
      <text
        x={vertical ? mx + offset : mx}
        y={vertical ? my : my + offset}
        fill={ink}
        stroke="none"
        fontSize={9}
        fontFamily="var(--font-sans)"
        textAnchor="middle"
        dominantBaseline={vertical ? "middle" : "auto"}
        transform={vertical ? `rotate(-90 ${mx + offset} ${my})` : undefined}
      >
        {label}
      </text>
    </g>
  );
}

export function ReceptionDeskDrawing({ revision, superseded, title = "Harbour Lane Hotel, reception desk with back panel", sheetRef = "HLH-RD-01" }: { revision: string; superseded?: boolean; title?: string; sheetRef?: string }) {
  const backH = revision === "B" ? 1900 : 2100;
  // Scale: 1 unit = 1mm / 4 in the elevation view.
  const s = 0.1;
  const elevX = 70;
  const elevY = 300;
  const deskW = 2400 * s;
  const deskH = 1100 * s;
  const panelH = backH * s;
  const panelTop = elevY + deskH - panelH;

  const planX = 70;
  const planY = 60;
  const planD = 800 * s;


  return (
    <svg viewBox="0 0 440 500" className="drawing" role="img" aria-label={`Reception desk drawing, revision ${revision}`}>
      <rect x="0.5" y="0.5" width="439" height="499" fill="var(--c-surface)" stroke={ink} strokeWidth="1" />
      <rect x="8.5" y="8.5" width="423" height="483" fill="none" stroke={thin} strokeWidth="0.5" />

      {/* Plan */}
      <text x={planX} y={planY - 14} fontSize="9" fill={thin} fontFamily="var(--font-sans)">PLAN 1:40</text>
      <g stroke={ink} strokeWidth="1.2" fill="none">
        <rect x={planX} y={planY} width={deskW} height={planD} />
        <path d={`M${planX} ${planY + planD} q ${deskW / 2} ${-planD * 0.45} ${deskW} 0`} strokeWidth="0.8" />
        <line x1={planX} y1={planY + 18 * s * 10} x2={planX + deskW} y2={planY + 18 * s * 10} strokeWidth="0.6" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={planX + (i * deskW) / 4} y1={planY} x2={planX + (i * deskW) / 4} y2={planY + planD} strokeWidth="0.5" strokeDasharray="3 2" />
        ))}
      </g>
      <Dim x1={planX} y1={planY + planD + 16} x2={planX + deskW} y2={planY + planD + 16} label="2400" offset={-3} />
      <Dim x1={planX + deskW + 14} y1={planY} x2={planX + deskW + 14} y2={planY + planD} label="800" offset={8} vertical />

      {/* Front elevation */}
      <text x={elevX} y={elevY - panelH + deskH - 14 < 190 ? 190 : elevY - 14} fontSize="9" fill={thin} fontFamily="var(--font-sans)">FRONT ELEVATION 1:40</text>
      <g stroke={ink} strokeWidth="1.2" fill="none">
        {/* back panel */}
        <rect x={elevX + 6} y={panelTop} width={deskW - 12} height={panelH} strokeWidth="0.9" />
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={elevX + 6} y1={panelTop + (i * panelH) / 6} x2={elevX + deskW - 6} y2={panelTop + (i * panelH) / 6} strokeWidth="0.4" />
        ))}
        {/* desk */}
        <rect x={elevX} y={elevY} width={deskW} height={deskH} fill="var(--c-surface)" />
        <rect x={elevX} y={elevY} width={deskW} height={4} fill={ink} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={elevX + 2 + i * (deskW / 3)} y={elevY + 10} width={deskW / 3 - 4} height={deskH - 16} strokeWidth="0.7" />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={elevX + deskW - 44 + (i % 2) * 20} y={elevY + 12 + Math.floor(i / 2) * 20} width={16} height={16} strokeWidth="0.5" />
        ))}
      </g>
      <Dim x1={elevX} y1={elevY + deskH + 16} x2={elevX + deskW} y2={elevY + deskH + 16} label="2400" offset={-3} />
      <Dim x1={elevX - 14} y1={elevY} x2={elevX - 14} y2={elevY + deskH} label="1100" offset={-8} vertical />
      <Dim x1={elevX + deskW + 14} y1={panelTop} x2={elevX + deskW + 14} y2={elevY + deskH} label={String(backH)} offset={8} vertical />
      <line x1={elevX - 20} y1={elevY + deskH} x2={elevX + deskW + 20} y2={elevY + deskH} stroke={ink} strokeWidth="1.6" />
      <text x={elevX + deskW + 22} y={elevY + deskH + 3} fontSize="7" fill={thin} fontFamily="var(--font-sans)">FFL</text>

      {/* Title block */}
      <g fontFamily="var(--font-sans)" fill={ink}>
        <rect x="8.5" y="436.5" width="423" height="55" fill="var(--c-surface)" stroke={ink} strokeWidth="0.8" />
        <line x1="8.5" y1="454" x2="431.5" y2="454" stroke={thin} strokeWidth="0.5" />
        <line x1="300" y1="436.5" x2="300" y2="491.5" stroke={thin} strokeWidth="0.5" />
        <line x1="370" y1="436.5" x2="370" y2="491.5" stroke={thin} strokeWidth="0.5" />
        <text x="16" y="448" fontSize="7" fill={thin}>PROJECT</text>
        <text x="16" y="470" fontSize="11" fontWeight="600">{title.length > 54 ? title.slice(0, 52) + "…" : title}</text>
        <text x="16" y="484" fontSize="8" fill={thin}>Oak veneered MDF on birch ply carcass. Matt water-based lacquer.</text>
        <text x="306" y="448" fontSize="7" fill={thin}>DRAWING</text>
        <text x="306" y="470" fontSize="11" fontWeight="600">{sheetRef}</text>
        <text x="306" y="484" fontSize="8" fill={thin}>Sheet 1 of 1</text>
        <text x="376" y="448" fontSize="7" fill={thin}>REVISION</text>
        <text x="376" y="476" fontSize="22" fontWeight="600" letterSpacing="-0.5">{revision}</text>
      </g>

      {superseded && (
        <g transform="rotate(-24 220 250)">
          <rect x="60" y="222" width="320" height="56" rx="6" fill="var(--c-surface)" stroke="var(--c-overdue)" strokeWidth="2.5" opacity="0.95" />
          <text x="220" y="259" fontSize="26" fontWeight="700" fill="var(--c-overdue)" textAnchor="middle" letterSpacing="4" fontFamily="var(--font-sans)">
            SUPERSEDED
          </text>
        </g>
      )}
    </svg>
  );
}
