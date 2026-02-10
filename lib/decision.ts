export type Decision = "SCALE" | "TEST" | "KILL";

export function decide(clicks: number, conversions: number, epc: number) {
  if (conversions >= 2 && clicks >= 50 && epc >= 0.2) {
    return { decision: "SCALE" as Decision, reason: "2+ conversions, 50+ clicks, EPC >= $0.20" };
  }

  if (
    (clicks >= 20 && clicks <= 49 && conversions >= 1) ||
    (clicks >= 50 && conversions < 2 && epc >= 0.1 && epc <= 0.19)
  ) {
    return { decision: "TEST" as Decision, reason: "Needs additional validation window" };
  }

  if (clicks >= 80 && conversions === 0) {
    return { decision: "KILL" as Decision, reason: "High click volume with zero conversions" };
  }

  return { decision: "TEST" as Decision, reason: "Insufficient data" };
}
