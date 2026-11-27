// A simple technical drawing of the reception desk, as SVG. The real app opens a
// PDF here. Front elevation and plan, with a title block. Everything is fictional.

type Props = { revision: "B" | "C"; width?: number | string; className?: string };

function Dim({ x1, y1, x2, y2, label, offset = 18, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; vertical?: boolean }) {
  // A dimension line with ticks and the figure above it.
  if (vertical) {
    const x = x1 + offset;
    return (
      <g stroke="#1b1f23" strokeWidth={0.8} fill="none">
        <line x1={x1} y1={y1} x2={x + 6} y2={y1} />
        <line x1={x1} y1={y2} x2={x + 6} y2={y2} />
        <line x1={x} y1={y1} x2={x} y2={y2} />
        <line x1={x - 3} y1={y1 + 3} x2={x + 3} y2={y1 - 3} />
        <line x1={x - 3} y1={y2 + 3} x2={x + 3} y2={y2 - 3} />
        <text x={x + 5} y={(y1 + y2) / 2} fontSize={9} fill="#1b1f23" stroke="none" fontFamily="Barlow, Arial, sans-serif" dominantBaseline="middle">
          {label}
        </text>
      </g>
    );
  }
  const y = y1 + offset;
  return (
    <g stroke="#1b1f23" strokeWidth={0.8} fill="none">
      <line x1={x1} y1={y1} x2={x1} y2={y + 6} />
      <line x1={x2} y1={y2} x2={x2} y2={y + 6} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1 - 3} y1={y + 3} x2={x1 + 3} y2={y - 3} />
      <line x1={x2 - 3} y1={y + 3} x2={x2 + 3} y2={y - 3} />
      <text x={(x1 + x2) / 2} y={y - 3} fontSize={9} fill="#1b1f23" stroke="none" fontFamily="Barlow, Arial, sans-serif" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export function ReceptionDesk({ revision, width = "100%", className }: Props) {
  // Revision C added the back panel return and moved the drawer bank to the left.
  const revC = revision === "C";
  const ink = "#1b1f23";
  const thin = 0.7;
  const thick = 1.6;
  return (
    <svg viewBox="0 0 840 594" width={width} className={className} role="img" aria-label={`Reception desk drawing, revision ${revision}`} style={{ background: "#fff", display: "block" }}>
      {/* Sheet border and title block */}
      <rect x={10} y={10} width={820} height={574} fill="none" stroke={ink} strokeWidth={thick} />
      <rect x={10} y={514} width={820} height={70} fill="none" stroke={ink} strokeWidth={thin} />
      <line x1={330} y1={514} x2={330} y2={584} stroke={ink} strokeWidth={thin} />
      <line x1={600} y1={514} x2={600} y2={584} stroke={ink} strokeWidth={thin} />
      <line x1={700} y1={514} x2={700} y2={584} stroke={ink} strokeWidth={thin} />
      <line x1={10} y1={549} x2={330} y2={549} stroke={ink} strokeWidth={thin} />
      <g fontFamily="Barlow, Arial, sans-serif" fill={ink}>
        <text x={20} y={532} fontSize={9}>Client</text>
        <text x={20} y={544} fontSize={12} fontWeight={600}>Harbour Lane Hotel</text>
        <text x={20} y={566} fontSize={9}>Piece</text>
        <text x={20} y={578} fontSize={12} fontWeight={600}>Reception desk with back panel</text>
        <text x={340} y={532} fontSize={9}>Drawing</text>
        <text x={340} y={546} fontSize={14} fontWeight={700}>HLH-RD-01</text>
        <text x={340} y={566} fontSize={9}>Scale</text>
        <text x={340} y={578} fontSize={12} fontWeight={600}>1:20 at A3</text>
        <text x={470} y={532} fontSize={9}>Job</text>
        <text x={470} y={546} fontSize={14} fontWeight={700}>J-1042</text>
        <text x={470} y={566} fontSize={9}>Drawn</text>
        <text x={470} y={578} fontSize={12} fontWeight={600}>SM</text>
        <text x={610} y={532} fontSize={9}>Status</text>
        <text x={610} y={546} fontSize={12} fontWeight={700}>{revC ? "APPROVED" : "SUPERSEDED"}</text>
        <text x={610} y={566} fontSize={9}>Sheet</text>
        <text x={610} y={578} fontSize={12} fontWeight={600}>1 of 1</text>
        <text x={710} y={532} fontSize={9}>Revision</text>
        <text x={760} y={575} fontSize={44} fontWeight={700} textAnchor="middle" fontFamily="Barlow Condensed, Arial Narrow, sans-serif">
          {revision}
        </text>
      </g>

      {/* Front elevation */}
      <g fontFamily="Barlow, Arial, sans-serif" fill={ink}>
        <text x={40} y={30} fontSize={11} fontWeight={700} letterSpacing={1}>FRONT ELEVATION</text>
      </g>
      <g stroke={ink} fill="none" strokeWidth={thick}>
        {/* Desk top, 2400 x 40 */}
        <rect x={60} y={70} width={480} height={8} />
        {/* Front panels */}
        <rect x={64} y={78} width={472} height={212} />
        <line x1={222} y1={78} x2={222} y2={290} strokeWidth={thin} />
        <line x1={380} y1={78} x2={380} y2={290} strokeWidth={thin} />
        {/* Plinth */}
        <rect x={72} y={290} width={456} height={14} strokeWidth={thin} />
        {/* Back panel behind, taller */}
        <rect x={40} y={30 + 10} width={520} height={30} strokeWidth={thin} strokeDasharray="4 3" />
        {/* Raised counter */}
        <rect x={60} y={52} width={480} height={18} strokeWidth={thin} />
      </g>
      {/* Slat detail on front panels */}
      <g stroke={ink} strokeWidth={0.5}>
        {Array.from({ length: 23 }).map((_, i) => (
          <line key={i} x1={74 + i * 20} y1={90} x2={74 + i * 20} y2={278} />
        ))}
      </g>
      <Dim x1={60} y1={304} x2={540} y2={304} label="2400" offset={22} />
      <Dim x1={64} y1={304} x2={222} y2={304} label="800" offset={10} />
      <Dim x1={540} y1={70} x2={540} y2={290} label="1100" offset={14} vertical />
      <Dim x1={540} y1={52} x2={540} y2={70} label="90" offset={40} vertical />

      {/* Side elevation */}
      <g fontFamily="Barlow, Arial, sans-serif" fill={ink}>
        <text x={620} y={30} fontSize={11} fontWeight={700} letterSpacing={1}>SIDE</text>
      </g>
      <g stroke={ink} fill="none" strokeWidth={thick}>
        <rect x={640} y={70} width={160} height={8} />
        <rect x={660} y={78} width={120} height={212} />
        <rect x={668} y={290} width={104} height={14} strokeWidth={thin} />
        <rect x={640} y={52} width={60} height={18} strokeWidth={thin} />
        {/* back panel upstand, rev C adds a return */}
        {revC && <rect x={780} y={40} width={16} height={250} strokeWidth={thin} />}
        {!revC && <rect x={784} y={40} width={8} height={38} strokeWidth={thin} strokeDasharray="4 3" />}
      </g>
      <Dim x1={640} y1={304} x2={800} y2={304} label="800" offset={22} />
      {revC && <Dim x1={796} y1={40} x2={796} y2={290} label="2100" offset={14} vertical />}

      {/* Plan */}
      <g fontFamily="Barlow, Arial, sans-serif" fill={ink}>
        <text x={40} y={372} fontSize={11} fontWeight={700} letterSpacing={1}>PLAN</text>
      </g>
      <g stroke={ink} fill="none" strokeWidth={thick}>
        <rect x={60} y={386} width={480} height={100} />
        {/* back panel in plan */}
        <rect x={40} y={376} width={520} height={10} strokeWidth={thin} />
        {/* drawer bank: left in C, right in B */}
        <rect x={revC ? 72 : 400} y={398} width={128} height={76} strokeWidth={thin} />
        <line x1={revC ? 72 : 400} y1={424} x2={revC ? 200 : 528} y2={424} strokeWidth={0.5} />
        <line x1={revC ? 72 : 400} y1={450} x2={revC ? 200 : 528} y2={450} strokeWidth={0.5} />
        {/* shelves under counter */}
        <line x1={222} y1={386} x2={222} y2={486} strokeWidth={thin} strokeDasharray="6 3" />
        <line x1={380} y1={386} x2={380} y2={486} strokeWidth={thin} strokeDasharray="6 3" />
        {/* knee space */}
        <rect x={232} y={398} width={138} height={76} strokeWidth={0.5} strokeDasharray="2 2" />
      </g>
      <Dim x1={60} y1={486} x2={540} y2={486} label="2400" offset={16} />
      <Dim x1={540} y1={386} x2={540} y2={486} label="800" offset={14} vertical />
      <g fontFamily="Barlow, Arial, sans-serif" fill={ink} fontSize={8}>
        <text x={revC ? 80 : 408} y={412}>DRAWER BANK x6</text>
        <text x={240} y={412}>KNEE SPACE</text>
        <text x={620} y={386} fontSize={9} fontWeight={600}>Notes</text>
        <text x={620} y={400}>1. All sheet material 18mm oak veneered MDF unless noted.</text>
        <text x={620} y={412}>2. Carcass 18mm birch ply.</text>
        <text x={620} y={424}>3. Edges 2mm ABS oak to match.</text>
        <text x={620} y={436}>4. Finish: water-based lacquer, matt.</text>
        {revC && <text x={620} y={456} fontWeight={700}>Rev C: back panel return added, drawer bank moved to left.</text>}
        {!revC && <text x={620} y={456}>Rev B: counter height revised to 1100.</text>}
        <text x={620} y={476}>Do not scale. Check all dimensions on site.</text>
      </g>
    </svg>
  );
}
