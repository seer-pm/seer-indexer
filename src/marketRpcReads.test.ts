import { beforeEach, describe, expect, it, vi } from "vitest";

const readContract = vi.fn();
vi.mock("./chain", () => ({ getPublicClient: () => ({ readContract }) }));

import { readCollateralTokenRaw } from "./marketRpcReads";

const FACTORY = "0x00000000000000000000000000000000000000f1";
const MARKET = "0x00000000000000000000000000000000000000a1";
const MARKET_COLLATERAL = "0x00000000000000000000000000000000000000c2";
const FACTORY_COLLATERAL = "0x00000000000000000000000000000000000000c1";

describe("readCollateralTokenRaw", () => {
  beforeEach(() => readContract.mockReset());

  it("takes the collateral the market stores", async () => {
    readContract.mockResolvedValueOnce(MARKET_COLLATERAL);

    expect(await readCollateralTokenRaw(100, 1n, FACTORY, MARKET)).toBe(MARKET_COLLATERAL);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract.mock.calls[0][0]).toMatchObject({ address: MARKET, functionName: "collateralToken" });
  });

  it("falls back to the factory for a market without the getter", async () => {
    readContract.mockRejectedValueOnce(new Error("execution reverted"));
    readContract.mockResolvedValueOnce(FACTORY_COLLATERAL);

    expect(await readCollateralTokenRaw(100, 1n, FACTORY, MARKET)).toBe(FACTORY_COLLATERAL);
    expect(readContract).toHaveBeenCalledTimes(2);
    expect(readContract.mock.calls[1][0]).toMatchObject({ address: FACTORY, functionName: "collateralToken" });
  });
});
