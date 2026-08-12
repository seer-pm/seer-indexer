import { describe, expect, it, vi } from "vitest";
import { saveEconomicRouterCollateral } from "./economicTransfers";

function mockContext() {
  const transfers: Record<string, unknown>[] = [];
  const tokens = new Map<string, { id: string }>();
  const activities = new Map<string, Record<string, unknown>>();

  return {
    transfers,
    tokens,
    activities,
    context: {
      Token: {
        get: vi.fn(async (id: string) => tokens.get(id)),
        set: vi.fn((row: { id: string }) => {
          tokens.set(row.id, row);
        }),
      },
      Transfer: {
        set: vi.fn((row: Record<string, unknown>) => {
          transfers.push(row);
        }),
      },
      AccountActivity: {
        get: vi.fn(async (id: string) => activities.get(id)),
        set: vi.fn((row: Record<string, unknown>) => {
          activities.set(row.id as string, row);
        }),
      },
      TokenBalance: {
        get: vi.fn(),
        set: vi.fn(),
      },
      TokenBalanceDaily: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  };
}

describe("saveEconomicRouterCollateral", () => {
  const primary = "0xaf204776c7245bf4147c2612bf6e5972ee483701" as `0x${string}`;
  const user = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const router = "0xec9048b59b3467415b1a38f63416407ea0c70fb8" as `0x${string}`;
  const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("emits synthetic router_collateral without mutating TokenBalance", async () => {
    const { context, transfers } = mockContext();

    await saveEconomicRouterCollateral(context, {
      chainId: 100,
      primaryToken: primary,
      from: user,
      to: router,
      value: 1_000n,
      blockNumber: 42n,
      timestamp: 1_700_000_000n,
      transactionHash: txHash,
      transactionFrom: user,
      logIndex: 7,
      marketId: "100:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(transfers).toHaveLength(1);
    const t = transfers[0]!;
    expect(t.kind).toBe("router_collateral");
    expect(t.involvesRouter).toBe(true);
    expect(t.from).toBe(user);
    expect(t.to).toBe(router);
    expect(t.value).toBe(1_000n);
    expect(t.token_id).toBe(primary);
    expect(t.transactionFrom).toBe(user);
    expect(t.id).toBe(`100:${txHash}-7-econ-router_collateral`);
    expect(t.market_id).toBe("100:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

    expect(context.TokenBalance.set).not.toHaveBeenCalled();
    expect(context.TokenBalanceDaily.set).not.toHaveBeenCalled();
    expect(context.Token.set).toHaveBeenCalledWith({ id: primary });
    expect(context.AccountActivity.set).toHaveBeenCalled();
  });

  it("skips zero-value transfers", async () => {
    const { context, transfers } = mockContext();

    await saveEconomicRouterCollateral(context, {
      chainId: 100,
      primaryToken: primary,
      from: user,
      to: router,
      value: 0n,
      blockNumber: 1n,
      timestamp: 1n,
      transactionHash: txHash,
      transactionFrom: user,
      logIndex: 0,
    });

    expect(transfers).toHaveLength(0);
    expect(context.Transfer.set).not.toHaveBeenCalled();
  });

  it("normalizes addresses and tx hash to lowercase", async () => {
    const { context, transfers } = mockContext();
    const mixedPrimary = "0xAf204776C7245Bf4147c2612Bf6e5972Ee483701" as `0x${string}`;
    const mixedUser = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const mixedTx = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    await saveEconomicRouterCollateral(context, {
      chainId: 100,
      primaryToken: mixedPrimary,
      from: mixedUser,
      to: router,
      value: 5n,
      blockNumber: 1n,
      timestamp: 1n,
      transactionHash: mixedTx,
      transactionFrom: mixedUser,
      logIndex: 1n,
    });

    expect(transfers[0]!.token_id).toBe(mixedPrimary.toLowerCase());
    expect(transfers[0]!.transactionHash).toBe(mixedTx.toLowerCase());
    expect(transfers[0]!.id).toContain("-econ-router_collateral");
    expect(context.TokenBalance.set).not.toHaveBeenCalled();
  });
});
