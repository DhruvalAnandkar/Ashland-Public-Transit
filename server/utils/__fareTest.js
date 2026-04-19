/* eslint-disable no-console */
/**
 * Ad-hoc validation suite for the APT fare calculator.
 * Verifies every rate and rule penny-for-penny against the official
 * City of Ashland rate card.
 *
 * Run:  node server/utils/__fareTest.js
 */
const fc = require("./fareCalculator");
const { calculateFare, getFareBreakdown, getNoShowFee } = fc;

const cases = [
  // SCHEDULED (24h+) — in-city
  ["Scheduled · General · 1 pax",                      ["General", false, 1],           3.00],
  ["Scheduled · General · 2 pax (companion ½)",        ["General", false, 2],           4.50],
  ["Scheduled · General · 3 pax (2nd ½, 3rd full)",    ["General", false, 3],           7.50],
  ["Scheduled · General · 5 pax",                      ["General", false, 5],          13.50],
  ["Scheduled · Elderly/Disabled · 1 pax",             ["Elderly/Disabled", false, 1],  1.50],
  ["Scheduled · Elderly/Disabled · 2 pax",             ["Elderly/Disabled", false, 2],  4.50],
  ["Scheduled · ChildWithAdult · 1 pax",               ["ChildWithAdult", false, 1],    0.00],
  ["Scheduled · ChildAlone · 1 pax",                   ["ChildAlone", false, 1],        1.50],

  // SAME-DAY — in-city
  ["Same-Day · General · 1 pax",                       ["General", true, 1],            5.00],
  ["Same-Day · General · 2 pax (companion ½)",         ["General", true, 2],            7.50],
  ["Same-Day · General · 3 pax",                       ["General", true, 3],           12.50],
  ["Same-Day · Elderly/Disabled · 1 pax",              ["Elderly/Disabled", true, 1],   2.50],
  ["Same-Day · Elderly/Disabled · 2 pax",              ["Elderly/Disabled", true, 2],   7.50],
  ["Same-Day · ChildWithAdult · 1 pax",                ["ChildWithAdult", true, 1],     0.00],
  ["Same-Day · ChildAlone · 1 pax",                    ["ChildAlone", true, 1],         2.50],

  // Legacy tier aliases — must still resolve cleanly
  ["Alias Senior → Elderly/Disabled (scheduled)",      ["Senior", false, 1],            1.50],
  ["Alias Standard → General (same-day)",              ["Standard", true, 1],           5.00],
  ["Alias Student → General (scheduled)",              ["Student", false, 1],           3.00],
  ["Alias Veteran → General (same-day)",               ["Veteran", true, 1],            5.00],

  // Child handling via options flag
  ["Child + childWithAdult=true (scheduled)",
    ["Child", false, 1, false, 0, { childWithAdult: true }], 0.00],
  ["Child + childWithAdult=false (scheduled)",
    ["Child", false, 1, false, 0, { childWithAdult: false }], 1.50],
  ["Child + childWithAdult=true (same-day)",
    ["Child", true, 1, false, 0, { childWithAdult: true }], 0.00],
  ["Child + childWithAdult=false (same-day)",
    ["Child", true, 1, false, 0, { childWithAdult: false }], 2.50],
];

let pass = 0;
let fail = 0;
for (const [label, args, expected] of cases) {
  const got = calculateFare(...args);
  const ok = Math.abs(got - expected) < 0.0001;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `  [${ok ? "PASS" : "FAIL"}] ${label} => $${got.toFixed(2)}  (expected $${expected.toFixed(2)})`,
  );
}

console.log("");
console.log("── No-show fees ───────────────────────────");
console.log(`  General           => $${getNoShowFee("General").toFixed(2)}  (expected $3.00)`);
console.log(`  Elderly/Disabled  => $${getNoShowFee("Elderly/Disabled").toFixed(2)}  (expected $1.50)`);
console.log(`  ChildAlone        => $${getNoShowFee("ChildAlone").toFixed(2)}  (expected $1.50)`);
console.log(`  ChildWithAdult    => $${getNoShowFee("ChildWithAdult").toFixed(2)}  (expected $0.00)`);

console.log("");
console.log("── Breakdown example · Same-Day General 3 pax ─");
console.log(JSON.stringify(
  getFareBreakdown({ userType: "General", isSameDay: true, passengers: 3 }),
  null,
  2,
));

console.log("");
console.log(`Total: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
