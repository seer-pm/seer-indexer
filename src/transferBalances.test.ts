import { describe, expect, it } from "vitest";
import {
  accountActivityId,
  outcomeTokenMarketId,
  tokenBalanceDailyId,
  tokenBalanceId,
  utcDayStart,
} from "./transferBalances";

describe("transferBalances helpers", () => {
  it("utcDayStart floors to UTC midnight", () => {
    // 2024-01-02 12:00:00 UTC
    expect(utcDayStart(1_704_196_800)).toBe(1_704_153_600n);
    expect(utcDayStart(1_704_153_600n)).toBe(1_704_153_600n);
    expect(utcDayStart(1_704_153_601n)).toBe(1_704_153_600n);
  });

  it("builds stable entity ids", () => {
    expect(tokenBalanceId(100, "0xAbC", "0xDeF")).toBe("100:0xabc:0xdef");
    expect(tokenBalanceDailyId(100, "0xDeF", "0xAbC", 1_704_153_600n)).toBe(
      "100:0xdef:0xabc:1704153600",
    );
    expect(accountActivityId(100, "0xAbC")).toBe("100:0xabc");
    expect(outcomeTokenMarketId(100, "0xAbC")).toBe("100:0xabc");
  });
});
