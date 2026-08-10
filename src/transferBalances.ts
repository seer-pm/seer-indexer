// @ts-nocheck — Envio handler context is loosely typed until codegen settles.
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { getRouterAddress } from "./addresses";
import { entityId } from "./entityIds";

export type TransferKind = "outcome" | "router_collateral" | "lpp";

const SECONDS_PER_DAY = 86_400n;

export function addrLower(a: Address | string): `0x${string}` {
  return (a as string).toLowerCase() as `0x${string}`;
}

export function isZeroAddress(a: string): boolean {
  return addrLower(a) === zeroAddress;
}

/** UTC day start (unix seconds) containing `timestamp`. */
export function utcDayStart(timestamp: bigint | number): bigint {
  const ts = typeof timestamp === "bigint" ? timestamp : BigInt(timestamp);
  return (ts / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

export function tokenBalanceId(chainId: number, token: string, account: string): string {
  return entityId(chainId, `${addrLower(token)}:${addrLower(account)}`);
}

export function tokenBalanceDailyId(
  chainId: number,
  account: string,
  token: string,
  dayStart: bigint,
): string {
  return entityId(chainId, `${addrLower(account)}:${addrLower(token)}:${dayStart.toString()}`);
}

export function accountActivityId(chainId: number, account: string): string {
  return entityId(chainId, addrLower(account));
}

export function outcomeTokenMarketId(chainId: number, token: string): string {
  return entityId(chainId, addrLower(token));
}

export function involvesRouter(chainId: number, from: string, to: string): boolean {
  const router = getRouterAddress(chainId);
  if (!router) return false;
  const r = addrLower(router);
  return addrLower(from) === r || addrLower(to) === r;
}

function clampNonNegative(v: bigint): bigint {
  return v < 0n ? 0n : v;
}

/**
 * Apply a signed delta to head TokenBalance and sparse TokenBalanceDaily for one account.
 * Delta is positive for inbound, negative for outbound.
 */
export async function applyBalanceDelta(
  context: any,
  args: {
    chainId: number;
    token: `0x${string}`;
    account: `0x${string}`;
    delta: bigint;
    blockNumber: bigint;
    timestamp: bigint;
  },
): Promise<void> {
  const { chainId, token, account, delta, blockNumber, timestamp } = args;
  if (isZeroAddress(account) || delta === 0n) return;

  const balId = tokenBalanceId(chainId, token, account);
  const existing = await context.TokenBalance.get(balId);
  const prevBalance = (existing?.balance as bigint | undefined) ?? 0n;
  const nextBalance = clampNonNegative(prevBalance + delta);

  const dayStart = utcDayStart(timestamp);
  const dailyId = tokenBalanceDailyId(chainId, account, token, dayStart);
  const existingDaily = await context.TokenBalanceDaily.get(dailyId);

  let dailyBase: bigint;
  if (existingDaily) {
    dailyBase = existingDaily.balance as bigint;
  } else {
    dailyBase = 0n;
    const lastDay = (existing?.lastDailyDayStart as bigint | undefined) ?? 0n;
    if (lastDay > 0n) {
      const prevDaily = await context.TokenBalanceDaily.get(
        tokenBalanceDailyId(chainId, account, token, lastDay),
      );
      if (prevDaily) dailyBase = prevDaily.balance as bigint;
    } else {
      // First daily for this account+token: start from head before this delta.
      dailyBase = prevBalance;
    }
  }

  context.TokenBalanceDaily.set({
    id: dailyId,
    chainId: BigInt(chainId),
    account,
    token,
    dayStartTimestamp: dayStart,
    balance: clampNonNegative(dailyBase + delta),
  });

  context.TokenBalance.set({
    id: balId,
    chainId: BigInt(chainId),
    token,
    account,
    balance: nextBalance,
    updatedAtBlock: blockNumber,
    updatedAtTimestamp: timestamp,
    lastDailyDayStart: dayStart,
  });
}

export async function touchAccountActivity(
  context: any,
  chainId: number,
  account: `0x${string}`,
  timestamp: bigint,
): Promise<void> {
  if (isZeroAddress(account)) return;

  const id = accountActivityId(chainId, account);
  const existing = await context.AccountActivity.get(id);
  if (!existing) {
    context.AccountActivity.set({
      id,
      chainId: BigInt(chainId),
      account,
      earliestTransferTimestamp: timestamp,
      lastTransferTimestamp: timestamp,
      transferCount: 1n,
    });
    return;
  }

  const earliest =
    timestamp < existing.earliestTransferTimestamp ? timestamp : existing.earliestTransferTimestamp;
  const last = timestamp > existing.lastTransferTimestamp ? timestamp : existing.lastTransferTimestamp;
  context.AccountActivity.set({
    ...existing,
    earliestTransferTimestamp: earliest,
    lastTransferTimestamp: last,
    transferCount: existing.transferCount + 1n,
  });
}
