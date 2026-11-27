// A fictional workshop. Every name, client, address and phone number is invented.
// Phone numbers are from Ofcom's reserved drama range (07700 900000 to 900999), so
// none of them can ring a real person. Dates are relative to today, so the demo
// always looks current.
//
// People carry the server's ids (uuids) and slugs, and the demo sign-in details
// are the server's too (./demo.ts), so the memory source and the real back end
// behave the same.

import { daysFromToday as d, type Job, type Person } from "./domain";
import { PERSON_ID as P } from "./demo";

export const PEOPLE: Person[] = [
  { id: P.steve, slug: "p-steve", name: "Steve Marsden", initials: "SM", role: "manager", email: "steve.marsden@arris.demo" },
  { id: P.helen, slug: "p-helen", name: "Helen Carr", initials: "HC", role: "director", email: "helen.carr@arris.demo" },
  { id: P.gareth, slug: "p-gareth", name: "Gareth Holt", initials: "GH", role: "operative", teamRole: "Machine Operator" },
  { id: P.priya, slug: "p-priya", name: "Priya Nair", initials: "PN", role: "operative", teamRole: "Machine Operator" },
  { id: P.tom, slug: "p-tom", name: "Tom Ashworth", initials: "TA", role: "operative", teamRole: "Bench Joiner" },
  { id: P.sean, slug: "p-sean", name: "Sean McBride", initials: "SB", role: "operative", teamRole: "Bench Joiner" },
  { id: P.kieran, slug: "p-kieran", name: "Kieran Lowe", initials: "KL", role: "operative", teamRole: "Bench Joiner" },
  { id: P.dan, slug: "p-dan", name: "Dan Whitworth", initials: "DW", role: "operative", teamRole: "Bench Joiner" },
  { id: P.callum, slug: "p-callum", name: "Callum Reid", initials: "CR", role: "operative", teamRole: "Apprentice" },
  { id: P.josh, slug: "p-josh", name: "Josh Atherton", initials: "JA", role: "operative", teamRole: "Apprentice" },
  { id: P.liam, slug: "p-liam", name: "Liam Pickering", initials: "LP", role: "operative", teamRole: "Spray Booth" },
  { id: P.ryan, slug: "p-ryan", name: "Ryan Doyle", initials: "RD", role: "operative", teamRole: "Spray Booth" },
];

/** A person's id from their slug, such as "p-tom". */
export function personIdForSlug(slug: string): string | undefined {
  return PEOPLE.find((p) => p.slug === slug)?.id;
}

/** The job the vertical slice follows from New to Delivered. */
export const HERO_JOB_ID = "J-1042";

export const JOBS: Job[] = [
  {
    id: "J-1042", client: "Harbour Lane Hotel", ref: "HLH-RD-01", piece: "Reception desk with back panel",
    type: "Reception Desk", stage: "bench", flag: "None", assigned: [P.tom, P.callum],
    targetDate: d(6), installDate: d(13),
    hours: { materials: 2, cnc: 6, bench: 22, spray: 8, qc: 2 },
    site: { address: "Harbour Lane Hotel, 3 Quayside Walk, Eastport", contact: "Martha Reyes", phone: "07700 900142" },
    materials: [
      { id: "m1", name: "18mm birch ply", category: "Sheet Goods", qty: 8, unit: "sheets", supplier: "Brackenfold Timber", status: "issued" },
      { id: "m2", name: "18mm oak veneered MDF", category: "Sheet Goods", qty: 4, unit: "sheets", supplier: "Brackenfold Timber", status: "issued" },
      { id: "m3", name: "2mm ABS edging, oak", category: "Edging", qty: 40, unit: "m", supplier: "Larchmere Panels", status: "stock" },
      { id: "m4", name: "Soft-close drawer runners", category: "Ironmongery", qty: 6, unit: "pairs", supplier: "Ridgeway Ironmongery", status: "ordered" },
      { id: "m5", name: "Water-based lacquer, matt", category: "Finishes", qty: 5, unit: "L", supplier: "Larchmere Panels", status: "stock" },
    ],
    cuts: [
      { id: "c1", label: "Desk top", material: "18mm oak veneered MDF", qty: 1, dims: "2400 × 800", edging: "All edges", status: "complete" },
      { id: "c2", label: "Front panels", material: "18mm oak veneered MDF", qty: 3, dims: "800 × 1100", edging: "Long edges", status: "complete" },
      { id: "c3", label: "Carcass sides", material: "18mm birch ply", qty: 4, dims: "1100 × 600", edging: "Front", status: "edged" },
      { id: "c4", label: "Shelves", material: "18mm birch ply", qty: 6, dims: "780 × 380", edging: "Front", status: "cut" },
      { id: "c5", label: "Back panel", material: "18mm oak veneered MDF", qty: 2, dims: "1200 × 2100", edging: "None", status: "pending" },
      { id: "c6", label: "Drawer fronts", material: "18mm oak veneered MDF", qty: 6, dims: "396 × 180", edging: "All edges", status: "pending" },
    ],
    files: [
      { id: "f1", category: "drawing", name: "HLH-RD-01 Reception desk", revision: "B", superseded: true, sizeBytes: 2_310_000, uploadedBy: P.steve, uploadedAt: d(-12) },
      { id: "f2", category: "drawing", name: "HLH-RD-01 Reception desk", revision: "C", sizeBytes: 2_450_000, uploadedBy: P.steve, uploadedAt: d(-9) },
    ],
    notes: [{ by: P.tom, at: d(-1), text: "Carcass glued up. Back panel waiting on veneer match." }],
    history: [
      { at: d(-14), by: P.steve, text: "Job created" },
      { at: d(-9), by: P.steve, text: "Drawing revision C approved" },
      { at: d(-8), by: P.steve, text: "Moved to Materials" },
      { at: d(-5), by: P.gareth, text: "Moved to CNC / Machining" },
      { at: d(-2), by: P.gareth, text: "Moved to Bench Work" },
    ],
    version: 14,
  },
  {
    id: "J-1043", client: "Kestrel House Offices", ref: "KHO-SW-02", piece: "Feature slatted wall, reception",
    type: "Slatted Wall", stage: "spray", flag: "None", assigned: [P.liam],
    targetDate: d(2), installDate: d(5),
    hours: { cnc: 4, bench: 10, spray: 12, qc: 1 },
    site: { address: "Kestrel House, 18 Mill Lane, Millbridge", contact: "Owen Price", phone: "07700 900318" },
    materials: [{ id: "m1", name: "Solid oak, 25mm", category: "Solid Timber", qty: 180, unit: "m", supplier: "Brackenfold Timber", status: "issued" }],
    cuts: [], files: [{ id: "f1", category: "drawing", name: "KHO-SW-02 Slatted wall", revision: "A", sizeBytes: 1_850_000, uploadedBy: P.steve, uploadedAt: d(-10) }],
    notes: [], history: [{ at: d(-11), by: P.steve, text: "Job created" }], version: 9,
  },
  {
    id: "J-1044", client: "Ashby Street Primary", ref: "ASP-FD-12", piece: "FD30 fire door sets × 12",
    type: "Fire Door", stage: "cnc", flag: "Urgent", assigned: [P.gareth, P.priya],
    targetDate: d(1), installDate: d(4),
    hours: { cnc: 14, bench: 18, spray: 10, qc: 4 },
    site: { address: "Ashby Street Primary School, Ashby Street, Halford Green", contact: "Graham Lyle", phone: "07700 900577" },
    materials: [
      { id: "m1", name: "FD30 door blanks, 44mm", category: "Sheet Goods", qty: 12, unit: "units", supplier: "Ridgeway Doors", status: "stock" },
      { id: "m2", name: "FD30 latch kits", category: "Ironmongery", qty: 12, unit: "sets", supplier: "", status: "required" },
      { id: "m3", name: "Intumescent strip, 15mm", category: "Ironmongery", qty: 70, unit: "m", supplier: "Ridgeway Ironmongery", status: "ordered" },
    ],
    cuts: [], files: [{ id: "f1", category: "drawing", name: "ASP-FD-12 Door schedule", revision: "A", sizeBytes: 3_200_000, uploadedBy: P.steve, uploadedAt: d(-6) }],
    notes: [], history: [{ at: d(-7), by: P.steve, text: "Job created" }], version: 6,
  },
  {
    id: "J-1045", client: "The Weavers Arms", ref: "TWA-BS-03", piece: "Booth seating × 4, back bar",
    type: "Booth Seating", stage: "new", flag: "Awaiting Drawing", assigned: [],
    targetDate: d(24), installDate: d(31),
    hours: { materials: 2, cnc: 8, bench: 30, spray: 6, qc: 2 },
    site: { address: "The Weavers Arms, 41 Loom Street, Kettleby", contact: "Dee Walsh", phone: "07700 900233" },
    materials: [], cuts: [], files: [], notes: [], history: [{ at: d(-1), by: P.steve, text: "Job created" }], version: 1,
  },
  {
    id: "J-1046", client: "Marlow Yard Apartments", ref: "MYA-KC-07", piece: "Concierge desk and pigeonholes",
    type: "Bespoke Feature", stage: "bench", flag: "None", assigned: [P.sean, P.josh],
    targetDate: d(-2), installDate: d(3),
    hours: { cnc: 6, bench: 26, spray: 8, qc: 2 },
    site: { address: "Marlow Yard, 7 Canal Side, Rowanford", contact: "Isla Grant", phone: "07700 900461" },
    materials: [{ id: "m1", name: "18mm walnut veneered MDF", category: "Sheet Goods", qty: 10, unit: "sheets", supplier: "Brackenfold Timber", status: "issued" }],
    cuts: [], files: [{ id: "f1", category: "drawing", name: "MYA-KC-07 Concierge desk", revision: "D", sizeBytes: 2_100_000, uploadedBy: P.steve, uploadedAt: d(-15) }],
    notes: [], history: [{ at: d(-18), by: P.steve, text: "Job created" }], version: 21,
  },
  {
    id: "J-1047", client: "Northgate Dental", ref: "NGD-CB-04", piece: "Surgery cabinets × 3 rooms",
    type: "Cabinet", stage: "materials", flag: "Awaiting Materials", assigned: [],
    targetDate: d(10), installDate: d(17),
    hours: { materials: 3, cnc: 10, bench: 24, spray: 9, qc: 3 },
    site: { address: "Northgate Dental, 2 Station Parade, Oakhurst Vale", contact: "Dr Anil Shah", phone: "07700 900709" },
    materials: [
      { id: "m1", name: "18mm white MFC", category: "Sheet Goods", qty: 16, unit: "sheets", supplier: "Larchmere Panels", status: "ordered" },
      { id: "m2", name: "Blum concealed hinges, 110°", category: "Ironmongery", qty: 36, unit: "units", supplier: "Ridgeway Ironmongery", status: "required" },
    ],
    cuts: [], files: [{ id: "f1", category: "drawing", name: "NGD-CB-04 Cabinet elevations", revision: "B", sizeBytes: 1_640_000, uploadedBy: P.steve, uploadedAt: d(-3) }],
    notes: [], history: [{ at: d(-4), by: P.steve, text: "Job created" }], version: 4,
  },
  {
    id: "J-1048", client: "Brindle & Co Coffee", ref: "BCC-SH-01", piece: "Retail shelving and counter front",
    type: "Shelving", stage: "qc", flag: "None", assigned: [P.kieran],
    targetDate: d(0), installDate: d(2),
    hours: { cnc: 3, bench: 12, spray: 5, qc: 1 },
    site: { address: "Brindle & Co, 9 Fishergate Hill, Kettleby", contact: "Sam Okafor", phone: "07700 900855" },
    materials: [], cuts: [], files: [{ id: "f1", category: "drawing", name: "BCC-SH-01 Shelving", revision: "A", sizeBytes: 980_000, uploadedBy: P.steve, uploadedAt: d(-20) }],
    qc: { checked: [0, 1, 2, 3, 4] },
    notes: [], history: [{ at: d(-21), by: P.steve, text: "Job created" }], version: 17,
  },
  {
    id: "J-1049", client: "Kestrel House Offices", ref: "KHO-DR-05", piece: "Meeting room doors × 4",
    type: "Door", stage: "ready", flag: "None", assigned: [],
    targetDate: d(-1), installDate: d(1),
    hours: { cnc: 4, bench: 8, spray: 6, qc: 1 },
    site: { address: "Kestrel House, 18 Mill Lane, Millbridge", contact: "Owen Price", phone: "07700 900318" },
    materials: [], cuts: [], files: [{ id: "f1", category: "drawing", name: "KHO-DR-05 Door schedule", revision: "B", sizeBytes: 1_200_000, uploadedBy: P.steve, uploadedAt: d(-22) }],
    qc: { checked: [0, 1, 2, 3, 4, 5, 6, 7], signedBy: P.steve, signedAt: d(-1) },
    notes: [], history: [{ at: d(-24), by: P.steve, text: "Job created" }], version: 25,
  },
];
