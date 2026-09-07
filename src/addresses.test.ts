import { describe, expect, it } from "vitest";
import {
  getCtfRouterAddresses,
  getRealityProxyAddresses,
  getRouterAddress,
} from "./addresses";

const CONFIGURED_CHAINS = [100, 1, 10, 8453];

describe("getCtfRouterAddresses", () => {
  it("includes the Seer router on gnosis so the two lists cannot drift apart", () => {
    const routers = getCtfRouterAddresses(100);
    expect(routers).not.toBeNull();
    expect(routers).toContain(getRouterAddress(100));
  });

  it("also covers the futarchy router on gnosis", () => {
    expect(getCtfRouterAddresses(100)).toHaveLength(2);
  });

  it("does not filter the low-traffic chains", () => {
    expect(getCtfRouterAddresses(1)).toBeNull();
    expect(getCtfRouterAddresses(10)).toBeNull();
    expect(getCtfRouterAddresses(8453)).toBeNull();
  });
});

describe("getRealityProxyAddresses", () => {
  it("resolves an oracle for every configured chain", () => {
    for (const chainId of CONFIGURED_CHAINS) {
      expect(getRealityProxyAddresses(chainId).length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unconfigured chain", () => {
    expect(getRealityProxyAddresses(42161)).toEqual([]);
  });
});
