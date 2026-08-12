// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import { getRouterAddress } from "../addresses";
import {
  collateralForSplitMerge,
  isWrapMergeRedeemMethod,
  isWrapSplitMethod,
} from "../conditionalLogic";
import { entityId } from "../entityIds";
import { saveEconomicRouterCollateral } from "../economicTransfers";
import { addrLower, isSeerRouterAddress } from "../transferBalances";

function qid(p: `0x${string}` | string): string {
  return p.toLowerCase();
}

async function matchingMarkets(
  context: any,
  conditionMarketIds: string[],
  parentCol: string,
): Promise<any[]> {
  const out: any[] = [];
  for (const mid of conditionMarketIds) {
    const market = await context.Market.get(mid);
    if (!market) continue;
    if (market.parentCollectionId === parentCol) out.push(market);
  }
  return out;
}

function conditionalEventId(
  chainId: number,
  txHash: string,
  logIndex: number | bigint,
  marketId: string,
): string {
  return entityId(chainId, `${txHash}-${logIndex}-${marketId}`);
}

/**
 * When the on-chain stakeholder/redeemer is the Seer router (wrap methods like
 * `splitFromDai`, or non-wrap `splitPosition` / `mergePositions` / redeem via router),
 * attribute `accountId` to `transaction.from` so portfolio queries by user address resolve.
 */
function resolveAccountId(chainId: number, onChainParty: `0x${string}`, txFrom: `0x${string}`): `0x${string}` {
  if (isSeerRouterAddress(chainId, onChainParty)) return txFrom;
  return onChainParty;
}

async function maybeEmitWrapCollateral(
  context: any,
  args: {
    chainId: number;
    direction: "debit" | "credit";
    market: { id: string; collateralToken: string };
    account: `0x${string}`;
    amount: bigint;
    blockNumber: bigint;
    timestamp: bigint;
    transactionHash: string;
    transactionFrom: `0x${string}`;
    logIndex: number | bigint;
  },
): Promise<void> {
  const router = getRouterAddress(args.chainId);
  if (!router) return;
  const routerAddr = addrLower(router);
  const primary = addrLower(args.market.collateralToken);
  const from = args.direction === "debit" ? args.account : routerAddr;
  const to = args.direction === "debit" ? routerAddr : args.account;

  await saveEconomicRouterCollateral(context, {
    chainId: args.chainId,
    primaryToken: primary,
    from,
    to,
    value: args.amount,
    blockNumber: args.blockNumber,
    timestamp: args.timestamp,
    transactionHash: args.transactionHash,
    transactionFrom: args.transactionFrom,
    logIndex: args.logIndex,
    marketId: args.market.id,
  });
}

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PositionSplit" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const rawConditionId = qid(event.params.conditionId as `0x${string}`);
    const conditionId = entityId(chainId, rawConditionId);
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;

    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    const markets = await matchingMarkets(context, condition.marketIds, parentCol);
    const stakeholder = addrLower(event.params.stakeholder as Address);
    const txHash = (event.transaction as { hash: string }).hash.toLowerCase();
    const txFrom = addrLower((event.transaction as { from: string }).from);
    const txInput = (event.transaction as { input?: string }).input;
    const accountId = resolveAccountId(chainId, stakeholder, txFrom);
    const emitWrapDebit = isSeerRouterAddress(chainId, stakeholder) && isWrapSplitMethod(txInput);

    for (const market of markets) {
      context.Market.set({
        ...market,
        outcomesSupply: market.outcomesSupply + event.params.amount,
        updatedAt: event.block.timestamp,
      });
      context.ConditionalEvent.set({
        id: conditionalEventId(chainId, txHash, event.logIndex, market.id),
        chainId: BigInt(chainId),
        market_id: market.id,
        accountId,
        stakeholder,
        eventType: "split",
        amount: event.params.amount,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        collateral: collateralForSplitMerge(market, event.params.collateralToken as Address),
        parentCollectionId: parentCol,
        conditionId: rawConditionId,
        transactionHash: txHash,
      });
    }

    // One economic leg per CTF event (not per matching market).
    if (emitWrapDebit && markets.length > 0) {
      await maybeEmitWrapCollateral(context, {
        chainId,
        direction: "debit",
        market: markets[0],
        account: accountId,
        amount: event.params.amount as bigint,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        transactionHash: txHash,
        transactionFrom: txFrom,
        logIndex: event.logIndex,
      });
    }
  },
);

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PositionsMerge" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const rawConditionId = qid(event.params.conditionId as `0x${string}`);
    const conditionId = entityId(chainId, rawConditionId);
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;

    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    const markets = await matchingMarkets(context, condition.marketIds, parentCol);
    const stakeholder = addrLower(event.params.stakeholder as Address);
    const txHash = (event.transaction as { hash: string }).hash.toLowerCase();
    const txFrom = addrLower((event.transaction as { from: string }).from);
    const txInput = (event.transaction as { input?: string }).input;
    const accountId = resolveAccountId(chainId, stakeholder, txFrom);
    const emitWrapCredit = isSeerRouterAddress(chainId, stakeholder) && isWrapMergeRedeemMethod(txInput);

    for (const market of markets) {
      context.Market.set({
        ...market,
        outcomesSupply: market.outcomesSupply - event.params.amount,
        updatedAt: event.block.timestamp,
      });
      context.ConditionalEvent.set({
        id: conditionalEventId(chainId, txHash, event.logIndex, market.id),
        chainId: BigInt(chainId),
        market_id: market.id,
        accountId,
        stakeholder,
        eventType: "merge",
        amount: event.params.amount,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        collateral: collateralForSplitMerge(market, event.params.collateralToken as Address),
        parentCollectionId: parentCol,
        conditionId: rawConditionId,
        transactionHash: txHash,
      });
    }

    if (emitWrapCredit && markets.length > 0) {
      await maybeEmitWrapCollateral(context, {
        chainId,
        direction: "credit",
        market: markets[0],
        account: accountId,
        amount: event.params.amount as bigint,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        transactionHash: txHash,
        transactionFrom: txFrom,
        logIndex: event.logIndex,
      });
    }
  },
);

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PayoutRedemption" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const rawConditionId = qid(event.params.conditionId as `0x${string}`);
    const conditionId = entityId(chainId, rawConditionId);
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;

    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    const markets = await matchingMarkets(context, condition.marketIds, parentCol);
    const stakeholder = addrLower(event.params.redeemer as Address);
    const txHash = (event.transaction as { hash: string }).hash.toLowerCase();
    const txFrom = addrLower((event.transaction as { from: string }).from);
    const txInput = (event.transaction as { input?: string }).input;
    const accountId = resolveAccountId(chainId, stakeholder, txFrom);
    const emitWrapCredit = isSeerRouterAddress(chainId, stakeholder) && isWrapMergeRedeemMethod(txInput);

    for (const market of markets) {
      context.Market.set({
        ...market,
        outcomesSupply: market.outcomesSupply - event.params.payout,
        updatedAt: event.block.timestamp,
      });
      context.ConditionalEvent.set({
        id: conditionalEventId(chainId, txHash, event.logIndex, market.id),
        chainId: BigInt(chainId),
        market_id: market.id,
        accountId,
        stakeholder,
        eventType: "redeem",
        amount: event.params.payout,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        collateral: collateralForSplitMerge(market, event.params.collateralToken as Address),
        parentCollectionId: parentCol,
        conditionId: rawConditionId,
        transactionHash: txHash,
      });
    }

    if (emitWrapCredit && markets.length > 0) {
      await maybeEmitWrapCollateral(context, {
        chainId,
        direction: "credit",
        market: markets[0],
        account: accountId,
        amount: event.params.payout as bigint,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        transactionHash: txHash,
        transactionFrom: txFrom,
        logIndex: event.logIndex,
      });
    }
  },
);

indexer.onEvent(
  { contract: "ConditionalTokens", event: "ConditionResolution" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const conditionId = entityId(chainId, qid(event.params.conditionId as `0x${string}`));
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;
    const nums = [...event.params.payoutNumerators] as bigint[];
    for (const mid of condition.marketIds) {
      const market = await context.Market.get(mid);
      if (!market) continue;
      context.Market.set({
        ...market,
        payoutReported: true,
        payoutNumerators: nums,
        updatedAt: event.block.timestamp,
      });
    }
  },
);
