/**
 * Ashland Public Transit — OFFICIAL Fare Calculator
 * ==================================================================
 * Source: City of Ashland, OH — Public Transit Division
 *
 * HOURS OF OPERATION
 *   Monday – Friday ..... 6:00 a.m. – 9:00 p.m.
 *   Saturday ............ 8:00 a.m. – 6:00 p.m.
 *   Sunday & holidays ... CLOSED
 *
 * SCHEDULED AHEAD (booked ≥ 24 hours in advance), inside city limits
 *   General Public ............. $3.00 / one-way
 *   Elderly / Disabled ......... $1.50 / one-way
 *   Under 12 WITH adult ........ FREE
 *   Under 12 WITHOUT adult ..... $1.50
 *
 *   Companion: if a 2ND person rides to the SAME destination with a
 *   General-Public primary, the 2nd rider pays HALF the primary fare
 *   ($1.50 scheduled). Children under 12 with a fare-paying adult
 *   are always FREE (they are not the "2nd rider" companion).
 *
 * SAME-DAY SERVICE (booked < 24 hours ahead), inside city limits
 *   General Public ............. $5.00 / one-way
 *   Elderly / Disabled ......... $2.50 / one-way
 *   Under 12 WITH adult ........ FREE
 *   Under 12 WITHOUT adult ..... $2.50
 *
 *   Companion: 2nd rider to the SAME destination w/ a General-Public
 *   primary pays HALF the primary fare ($2.50 same-day).
 *
 * NO-SHOW FEES
 *   General Public ............. $3.00
 *   Elderly / Disabled ......... $1.50
 * ==================================================================
 *
 * IMPORTANT:
 *   • These are the ONLY rules published by APT. Any extras (airport
 *     flat rates, out-of-town mileage, all-day passes, Student or
 *     Veteran discounts) are NOT part of the official rate card and
 *     are therefore NOT applied by this calculator.
 *   • The rider’s user type governs the PRIMARY fare.
 *   • Additional passengers are billed per rule above; no rule exists
 *     for 3+ riders, so ONLY one companion (the 2nd) gets the half-
 *     price rate — any further riders pay their own applicable fare.
 *
 * Canonical user-type keys (case-sensitive):
 *   'General'           — general public adult (default)
 *   'Elderly/Disabled'  — 65+ or registered ADA rider
 *   'ChildWithAdult'    — under 12, accompanied by a fare-paying adult
 *   'ChildAlone'        — under 12, unaccompanied
 *
 * Legacy aliases accepted (mapped to canonical):
 *   'Standard' → 'General'
 *   'Senior'   → 'Elderly/Disabled'
 *   'Disabled' → 'Elderly/Disabled'
 *   'Child'    → 'ChildWithAdult' if childWithAdult flag is true,
 *                else 'ChildAlone'
 *
 * All returned amounts are USD and rounded to exactly 2 decimals
 * using banker-safe math.
 */

const IN_CITY_RATES = Object.freeze({
  Scheduled: Object.freeze({
    General: 3.0,
    "Elderly/Disabled": 1.5,
    ChildWithAdult: 0.0,
    ChildAlone: 1.5,
  }),
  SameDay: Object.freeze({
    General: 5.0,
    "Elderly/Disabled": 2.5,
    ChildWithAdult: 0.0,
    ChildAlone: 2.5,
  }),
});

const NO_SHOW_FEES = Object.freeze({
  General: 3.0,
  "Elderly/Disabled": 1.5,
  ChildAlone: 1.5,
  ChildWithAdult: 0.0,
});

/**
 * Convert whatever the caller sent into a canonical user-type key.
 * This is forgiving so that legacy mobile versions & dispatch tools
 * keep working — but the returned key always matches the official
 * rate table.
 */
function normalizeUserType(userType, options = {}) {
  const raw = String(userType || "").trim();
  const lower = raw.toLowerCase();

  if (raw === "General" || raw === "Standard" || lower === "general public")
    return "General";
  if (
    raw === "Elderly/Disabled" ||
    raw === "Senior" ||
    raw === "Disabled" ||
    lower === "elderly" ||
    lower === "elderly/disabled" ||
    lower === "ada"
  )
    return "Elderly/Disabled";
  if (raw === "ChildWithAdult") return "ChildWithAdult";
  if (raw === "ChildAlone") return "ChildAlone";
  if (raw === "Child" || lower === "under 12") {
    return options.childWithAdult ? "ChildWithAdult" : "ChildAlone";
  }

  // Legacy non-APT tiers fall back to General per the official rate card.
  return "General";
}

/**
 * Round to cents without floating-point drift.
 *   round2(0.1 + 0.2)       === 0.30
 *   round2(1.5 * 3)         === 4.50
 *   round2(2.5 / 2)         === 1.25
 */
function round2(n) {
  const v = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
}

/**
 * Look up the primary rider's base fare from the official table.
 * Returns an exact APT rate: 0, 1.5, 2.5, 3, or 5 USD.
 */
function primaryFare(canonicalType, isSameDay) {
  const tier = isSameDay ? "SameDay" : "Scheduled";
  const table = IN_CITY_RATES[tier];
  const fare = table[canonicalType];
  return fare === undefined ? table.General : fare;
}

/**
 * Companion rule (official text):
 *   "If a second person riding is going to the same destination as
 *    the general public rider, the second person pays half-price."
 *
 * Strict interpretation:
 *   • Only fires when the PRIMARY rider is General Public.
 *   • Applies to exactly ONE additional rider (the "2nd person").
 *   • Children under 12 traveling with that fare-paying General
 *     adult ride FREE — not half-price.
 *
 * `companionType` is the canonical type of the 2nd person; if the
 * 2nd person is a child WITH adult, APT rules say that child is
 * free, not half-price.
 */
function companionFare(primaryType, companionType, isSameDay) {
  if (primaryType !== "General") return 0;
  if (companionType === "ChildWithAdult") return 0;
  return round2(primaryFare("General", isSameDay) / 2);
}

/**
 * Build a line-item breakdown of the trip.
 *
 * @param {Object}  input
 * @param {string}  input.userType         Primary rider type (see normalizeUserType).
 * @param {boolean} input.isSameDay        true = same-day; false = scheduled ≥24h ahead.
 * @param {number}  input.passengers       Total riders (primary + companions). Default 1.
 * @param {boolean} input.childWithAdult   If primary is "Child", is an adult paying? Default false.
 * @param {Array}   input.companions       Optional array describing each additional rider:
 *                                         [{ userType, childWithAdult? }, ...]
 *                                         If omitted, the 2nd rider is assumed to be
 *                                         General (so the companion rule triggers).
 * @returns {{ lines: Array, total: number, tier: string, primaryType: string }}
 */
function getFareBreakdown(input = {}) {
  const {
    userType,
    isSameDay = false,
    passengers = 1,
    childWithAdult = false,
    companions,
  } = input || {};

  const primaryType = normalizeUserType(userType, { childWithAdult });
  const tier = isSameDay ? "Same-Day Service" : "Scheduled (24h+ Advance)";

  const lines = [];
  const totalPax = Math.max(1, Math.floor(Number(passengers) || 1));

  const primaryAmount = primaryFare(primaryType, isSameDay);
  lines.push({
    label: `Primary rider · ${humanLabel(primaryType)}`,
    amount: primaryAmount,
  });

  if (totalPax >= 2) {
    const list = Array.isArray(companions) ? companions.slice(0, totalPax - 1) : [];

    for (let i = 0; i < totalPax - 1; i += 1) {
      const raw = list[i] || {};
      const cType = normalizeUserType(raw.userType || "General", {
        childWithAdult: raw.childWithAdult,
      });

      let amount;
      let label;

      if (i === 0) {
        // The "2nd person" per the APT companion rule.
        amount = companionFare(primaryType, cType, isSameDay);
        if (primaryType === "General" && cType !== "ChildWithAdult") {
          label = `2nd rider · companion (½ off ${humanLabel("General")})`;
        } else if (cType === "ChildWithAdult") {
          label = `2nd rider · Under 12 with adult`;
        } else {
          amount = primaryFare(cType, isSameDay);
          label = `2nd rider · ${humanLabel(cType)}`;
        }
      } else {
        // 3rd+ rider — APT rules don't grant half-price, everyone
        // pays their own applicable fare.
        amount = primaryFare(cType, isSameDay);
        label = `Rider #${i + 2} · ${humanLabel(cType)}`;
      }

      lines.push({ label, amount });
    }
  }

  let total = 0;
  for (const ln of lines) total += Number(ln.amount) || 0;
  total = round2(total);

  return {
    tier,
    primaryType,
    isSameDay: !!isSameDay,
    passengers: totalPax,
    lines: lines.map((ln) => ({ ...ln, amount: round2(ln.amount) })),
    total,
  };
}

function humanLabel(canonical) {
  switch (canonical) {
    case "General":
      return "General Public";
    case "Elderly/Disabled":
      return "Elderly / Disabled";
    case "ChildWithAdult":
      return "Under 12 with adult";
    case "ChildAlone":
      return "Under 12 alone";
    default:
      return canonical;
  }
}

/**
 * Back-compat signature used by legacy call-sites.
 *
 *     calculateFare(userType, isSameDay, passengers [, ignored1, ignored2, options])
 *
 * The last two arguments (`isOutOfTown`, `miles`) and any option other
 * than `childWithAdult` / `companions` are INTENTIONALLY IGNORED: APT
 * doesn't publish out-of-town, airport, or wait-time fares, so we must
 * not invent them.
 */
function calculateFare(
  userType,
  isSameDay = false,
  passengers = 1,
  _legacyOutOfTown = false,
  _legacyMiles = 0,
  options = {},
) {
  const breakdown = getFareBreakdown({
    userType,
    isSameDay: !!isSameDay,
    passengers: Number(passengers) || 1,
    childWithAdult: !!(options && options.childWithAdult),
    companions: options && options.companions,
  });
  return breakdown.total;
}

function getNoShowFee(userType, options = {}) {
  const canonical = normalizeUserType(userType, options);
  const fee = NO_SHOW_FEES[canonical];
  return fee === undefined ? NO_SHOW_FEES.General : fee;
}

module.exports = calculateFare;
module.exports.calculateFare = calculateFare;
module.exports.getFareBreakdown = getFareBreakdown;
module.exports.getNoShowFee = getNoShowFee;
module.exports.normalizeUserType = normalizeUserType;
module.exports.round2 = round2;
module.exports.IN_CITY_RATES = IN_CITY_RATES;
module.exports.NO_SHOW_FEES = NO_SHOW_FEES;
