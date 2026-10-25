import { describe, expect, it } from "vitest";
import { DEFAULT_FINALIZE_TS, initialQuestionState, type QuestionRow } from "./marketsLogic";

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    opening_ts: 0n,
    arbitrator: "0x0000000000000000000000000000000000000001",
    timeout: 3600n,
    finalize_ts: 0n,
    is_pending_arbitration: false,
    best_answer: `0x${"0".repeat(64)}`,
    bond: 0n,
    min_bond: 0n,
    ...overrides,
  };
}

describe("initialQuestionState", () => {
  it("starts a market on fresh questions unanswered", () => {
    expect(initialQuestionState([question(), question()])).toEqual({
      hasAnswers: false,
      finalizeTs: DEFAULT_FINALIZE_TS,
      questionsInArbitration: 0n,
    });
  });

  it("takes the latest deadline when every question already has an answer", () => {
    expect(initialQuestionState([question({ finalize_ts: 100n }), question({ finalize_ts: 200n })])).toEqual({
      hasAnswers: true,
      finalizeTs: 200n,
      questionsInArbitration: 0n,
    });
  });

  it("keeps the default deadline while any question is unanswered", () => {
    const state = initialQuestionState([question({ finalize_ts: 100n }), question()]);
    expect(state.hasAnswers).toBe(true);
    expect(state.finalizeTs).toBe(DEFAULT_FINALIZE_TS);
  });

  it("counts questions already pending arbitration", () => {
    const state = initialQuestionState([
      question({ finalize_ts: 100n, is_pending_arbitration: true }),
      question({ finalize_ts: 100n }),
    ]);
    expect(state.questionsInArbitration).toBe(1n);
  });
});
