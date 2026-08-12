import { describe, expect, it } from "vitest";
import { isWrapMergeRedeemMethod, isWrapSplitMethod, txMethodId } from "./conditionalLogic";

/** Fake multicall top-level selector with a nested call body. */
function nestInMulticall(innerSelector: string, payloadHex = "0".repeat(64)): string {
  // 0xac9650d8 = multicall(bytes[]) — only used as a non-wrap outer selector
  return "0xac9650d8" + "0".repeat(128) + innerSelector.slice(2) + payloadHex;
}

describe("wrap router method detection", () => {
  it("txMethodId reads the 4-byte selector", () => {
    expect(txMethodId("0x59a89d8b00000000")).toBe("0x59a89d8b");
    expect(txMethodId("0x59")).toBeNull();
    expect(txMethodId(undefined)).toBeNull();
  });

  it("detects splitFromDai / splitFromBase at top-level", () => {
    expect(isWrapSplitMethod("0x59a89d8b" + "0".repeat(64))).toBe(true); // splitFromDai
    expect(isWrapSplitMethod("0x50d9991c" + "0".repeat(64))).toBe(true); // splitFromBase
    expect(isWrapSplitMethod("0xd5f82280" + "0".repeat(64))).toBe(false); // splitPosition
  });

  it("detects wrap-out merge/redeem selectors at top-level", () => {
    expect(isWrapMergeRedeemMethod("0x4c95d98b")).toBe(true); // mergeToDai
    expect(isWrapMergeRedeemMethod("0xb6fefc75")).toBe(true); // redeemToDai
    expect(isWrapMergeRedeemMethod("0xd6d150d1")).toBe(true); // mergeToBase
    expect(isWrapMergeRedeemMethod("0x9fe603e8")).toBe(true); // redeemToBase
    expect(isWrapMergeRedeemMethod("0x865955a0")).toBe(false); // redeemPositions
    expect(isWrapMergeRedeemMethod("0x7abef8d1")).toBe(false); // mergePositions
  });

  it("detects wrap selectors nested under multicall-style calldata", () => {
    expect(isWrapSplitMethod(nestInMulticall("0x59a89d8b"))).toBe(true); // splitFromDai
    expect(isWrapSplitMethod(nestInMulticall("0x50d9991c"))).toBe(true); // splitFromBase
    expect(isWrapMergeRedeemMethod(nestInMulticall("0x4c95d98b"))).toBe(true); // mergeToDai
    expect(isWrapMergeRedeemMethod(nestInMulticall("0xb6fefc75"))).toBe(true); // redeemToDai
    expect(isWrapMergeRedeemMethod(nestInMulticall("0xd6d150d1"))).toBe(true); // mergeToBase
    expect(isWrapMergeRedeemMethod(nestInMulticall("0x9fe603e8"))).toBe(true); // redeemToBase
  });

  it("does not treat nested non-wrap selectors as wrap", () => {
    expect(isWrapSplitMethod(nestInMulticall("0xd5f82280"))).toBe(false); // splitPosition
    expect(isWrapMergeRedeemMethod(nestInMulticall("0x7abef8d1"))).toBe(false); // mergePositions
    expect(isWrapMergeRedeemMethod(nestInMulticall("0x865955a0"))).toBe(false); // redeemPositions
  });

  it("returns false for empty / short input", () => {
    expect(isWrapSplitMethod(undefined)).toBe(false);
    expect(isWrapSplitMethod("0x59")).toBe(false);
    expect(isWrapMergeRedeemMethod(null)).toBe(false);
  });
});
