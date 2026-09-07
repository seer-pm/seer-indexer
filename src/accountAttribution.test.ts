import { describe, expect, it } from "vitest";
import { resolveAccountId } from "./accountAttribution";
import { getRouterAddress } from "./addresses";

const OPTIMISM = 10;
const ROUTER = getRouterAddress(OPTIMISM)!;
const OWNER = "0x02dadbe42f385fa68f96c753df7f24c863701481" as const;
const EXECUTOR = "0x7f93d9e40f0b393d2d5506d618aa0526496f374f" as const;
/** A browser session key authorized on EXECUTOR through `setTemporaryPermission`. */
const SESSION_KEY = "0x4d684bbc7296a913f95257b7d5659047031f65e6" as const;
const SAFE = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;

describe("resolveAccountId", () => {
  it("keeps a non-router stakeholder: the caller went to the CTF directly", () => {
    expect(resolveAccountId(OPTIMISM, OTHER, { from: OWNER, to: ROUTER })).toBe(OTHER);
  });

  it("books a direct router call to the signer", () => {
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: OWNER, to: ROUTER })).toBe(OWNER);
  });

  it("books an executor driven by a session key to the executor, not the key", () => {
    // The key never held collateral; the executor did, and it belongs to OWNER whoever signs.
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: SESSION_KEY, to: EXECUTOR })).toBe(EXECUTOR);
  });

  it("books an owner-signed executor call to the executor too", () => {
    // Same leg, same owner: attribution must not depend on which authorized key signed.
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: OWNER, to: EXECUTOR })).toBe(EXECUTOR);
  });

  it("books a contract wallet's leg to the wallet, not to the signer", () => {
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: OWNER, to: SAFE })).toBe(SAFE);
  });

  it("falls back to the signer when the transaction has no recipient", () => {
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: OWNER, to: null })).toBe(OWNER);
    expect(resolveAccountId(OPTIMISM, ROUTER, { from: OWNER })).toBe(OWNER);
  });

  it("lowercases whatever it returns", () => {
    expect(resolveAccountId(OPTIMISM, ROUTER.toUpperCase() as `0x${string}`, { from: OWNER, to: EXECUTOR.toUpperCase() })).toBe(
      EXECUTOR,
    );
    expect(resolveAccountId(OPTIMISM, OTHER.toUpperCase() as `0x${string}`, { from: OWNER, to: EXECUTOR })).toBe(OTHER);
  });

  it("stays on the raw party on a chain without a router", () => {
    expect(resolveAccountId(11_155_111, OTHER, { from: OWNER, to: EXECUTOR })).toBe(OTHER);
  });
});
