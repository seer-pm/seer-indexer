// @ts-nocheck — Envio handler context is loosely typed until codegen settles.
import { entityId } from "./entityIds";
import { addrLower, touchAccountActivity, type TransferKind } from "./transferBalances";

async function ensureToken(context: any, tokenAddress: `0x${string}`): Promise<void> {
  const existing = await context.Token.get(tokenAddress);
  if (existing) return;
  context.Token.set({ id: tokenAddress });
}

/**
 * Synthetic `router_collateral` for wrap router paths (`splitFromDai` / `*ToDai` / base equivalents).
 *
 * On those paths the economic primary leg never appears as a user↔router ERC20 Transfer of the
 * main collateral (DAI/base is used instead; sDAI may move only router↔CTF, which we intentionally
 * do not index). Emit an attributed primary Transfer so portfolio PnL can see the cost/credit
 * without mutating TokenBalance (skip balance deltas).
 */
export async function saveEconomicRouterCollateral(
  context: any,
  args: {
    chainId: number;
    primaryToken: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    blockNumber: bigint;
    timestamp: bigint;
    transactionHash: string;
    transactionFrom: `0x${string}`;
    logIndex: bigint | number;
    marketId?: string;
  },
): Promise<void> {
  const {
    chainId,
    primaryToken,
    from,
    to,
    value,
    blockNumber,
    timestamp,
    transactionHash,
    transactionFrom,
    logIndex,
    marketId,
  } = args;
  if (value === 0n) return;

  const tokenAddress = addrLower(primaryToken);
  await ensureToken(context, tokenAddress);

  const txHash = transactionHash.toLowerCase();
  const id = entityId(chainId, `${txHash}-${logIndex}-econ-router_collateral`);

  context.Transfer.set({
    id,
    chainId: BigInt(chainId),
    token_id: tokenAddress,
    from: addrLower(from),
    to: addrLower(to),
    value,
    blockNumber,
    timestamp,
    transactionHash: txHash,
    transactionFrom: addrLower(transactionFrom),
    logIndex: BigInt(logIndex),
    kind: "router_collateral" as TransferKind,
    involvesRouter: true,
    ...(marketId ? { market_id: marketId } : {}),
  });

  await touchAccountActivity(context, chainId, addrLower(from), timestamp);
  if (addrLower(from) !== addrLower(to)) {
    await touchAccountActivity(context, chainId, addrLower(to), timestamp);
  }
}
