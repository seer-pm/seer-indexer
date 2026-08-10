// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import { collateralForSplitMerge } from "../conditionalLogic";
import { entityId } from "../entityIds";
import { addrLower } from "../transferBalances";

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
        accountId: stakeholder,
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
        accountId: stakeholder,
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
        accountId: stakeholder,
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
