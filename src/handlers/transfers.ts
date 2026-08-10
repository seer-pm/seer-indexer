// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import { getConditionalTokensAddress, getMainCollateralAddresses, getRouterAddress } from "../addresses";
import { entityId } from "../entityIds";
import {
  addrLower,
  applyBalanceDelta,
  involvesRouter,
  outcomeTokenMarketId,
  touchAccountActivity,
  type TransferKind,
} from "../transferBalances";

async function ensureToken(context: any, tokenAddress: `0x${string}`): Promise<void> {
  const existing = await context.Token.get(tokenAddress);
  if (existing) return;
  context.Token.set({ id: tokenAddress });
}

function shouldIndexMainCollateralTransfer(event: any): boolean {
  const chainId = Number(event.chainId);
  const mainCollaterals = getMainCollateralAddresses(chainId);
  const router = getRouterAddress(chainId);
  if (mainCollaterals.length === 0 || !router) return false;

  const tokenAddress = addrLower(event.srcAddress);
  const mainCollateralSet = new Set(mainCollaterals.map(addrLower));
  const isMainCollateral = mainCollateralSet.has(tokenAddress);
  if (!isMainCollateral) return false;

  const routerAddr = addrLower(router);
  const from = addrLower(event.params.from);
  const to = addrLower(event.params.to);
  const routerInvolved = from === routerAddr || to === routerAddr;
  if (!routerInvolved) return false;

  const conditionalTokens = getConditionalTokensAddress(chainId);
  if (!conditionalTokens) return true;

  const ctf = addrLower(conditionalTokens);
  const ctfInvolved = from === ctf || to === ctf;
  if (ctfInvolved) return false;

  return true;
}

async function resolveOutcomeMarketId(
  context: any,
  chainId: number,
  tokenAddress: `0x${string}`,
): Promise<string | undefined> {
  const meta = await context.OutcomeTokenMarket.get(outcomeTokenMarketId(chainId, tokenAddress));
  return meta?.market_id as string | undefined;
}

async function saveTransfer(
  event: any,
  context: any,
  kind: TransferKind,
): Promise<void> {
  const chainId = Number(event.chainId);
  const tokenAddress = addrLower(event.srcAddress);
  await ensureToken(context, tokenAddress);

  const from = addrLower(event.params.from);
  const to = addrLower(event.params.to);
  const value = event.params.value as bigint;
  const timestamp = event.block.timestamp as bigint;
  const blockNumber = event.block.number as bigint;

  const txHash = (event.transaction as { hash: string }).hash?.toLowerCase();
  const txFrom = addrLower((event.transaction as { from: string }).from);
  const id = entityId(chainId, `${txHash}-${event.logIndex}`);

  const routerInvolved = involvesRouter(chainId, from, to);
  const marketId =
    kind === "outcome" ? await resolveOutcomeMarketId(context, chainId, tokenAddress) : undefined;

  context.Transfer.set({
    id,
    chainId: BigInt(chainId),
    token_id: tokenAddress,
    from,
    to,
    value,
    blockNumber,
    timestamp,
    transactionHash: txHash,
    transactionFrom: txFrom,
    logIndex: BigInt(event.logIndex),
    kind,
    involvesRouter: routerInvolved,
    ...(marketId ? { market_id: marketId } : {}),
  });

  await applyBalanceDelta(context, {
    chainId,
    token: tokenAddress,
    account: from,
    delta: -value,
    blockNumber,
    timestamp,
  });
  if (from !== to) {
    await applyBalanceDelta(context, {
      chainId,
      token: tokenAddress,
      account: to,
      delta: value,
      blockNumber,
      timestamp,
    });
  }

  await touchAccountActivity(context, chainId, from, timestamp);
  if (from !== to) {
    await touchAccountActivity(context, chainId, to, timestamp);
  }
}

indexer.onEvent(
  { contract: "OutcomeToken", event: "Transfer" },
  async ({ event, context }) => {
    await saveTransfer(event, context, "outcome");
  },
);

indexer.onEvent(
  { contract: "MainCollateral", event: "Transfer" },
  async ({ event, context }) => {
    if (!shouldIndexMainCollateralTransfer(event)) return;
    await saveTransfer(event, context, "router_collateral");
  },
);

indexer.onEvent(
  { contract: "SerLpp", event: "Transfer" },
  async ({ event, context }) => {
    await saveTransfer(event, context, "lpp");
  },
);
