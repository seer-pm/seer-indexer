import type { MarketProcessInput, QuestionRow } from "./marketsLogic";

export function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function parseMarketProcessInput(json: string): MarketProcessInput {
  const parsed = JSON.parse(json) as MarketProcessInput & {
    questions: (QuestionRow & Record<string, unknown>)[];
    [k: string]: unknown;
  };

  // Top-level bigint fields.
  for (const k of ["lowerBound", "upperBound", "parentOutcome", "templateId"] as const) {
    const v = (parsed as any)[k];
    if (typeof v === "string" || typeof v === "number") (parsed as any)[k] = BigInt(v);
  }

  // QuestionRow bigint fields.
  if (Array.isArray(parsed.questions)) {
    for (const q of parsed.questions as any[]) {
      for (const k of ["opening_ts", "timeout", "finalize_ts", "bond", "min_bond"] as const) {
        const v = q[k];
        if (typeof v === "string" || typeof v === "number") q[k] = BigInt(v);
      }
    }
  }

  return parsed;
}

