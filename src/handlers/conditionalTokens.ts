// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import {
  collateralForSplitMerge,
  getMarketFromTx,
  mergeMethods,
  redeemMethods,
  splitMethods,
} from "../conditionalLogic";
import { entityId } from "../entityIds";

function qid(p: `0x${string}` | string): string {
  return p.toLowerCase();
}

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PositionSplit" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const conditionId = entityId(chainId, qid(event.params.conditionId as `0x${string}`));
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;
    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    for (const mid of condition.marketIds) {
      const market = await context.Market.get(mid);
      if (!market) continue;
      if (market.parentCollectionId === parentCol) {
        context.Market.set({
          ...market,
          outcomesSupply: market.outcomesSupply + event.params.amount,
          updatedAt: event.block.timestamp,
        });
      }
    }
    const input = (event.transaction as { input?: `0x${string}` }).input;
    const market = await getMarketFromTx(context, chainId, input, splitMethods);
    if (!market) return;
    const full = await context.Market.get(market.id);
    if (!full) return;
    const id = entityId(
      chainId,
      `${(event.transaction as { hash: string }).hash.toLowerCase()}-${event.logIndex}`,
    );
    context.ConditionalEvent.set({
      id,
      chainId: BigInt(chainId),
      market_id: full.id,
      accountId: (event.transaction as { from: Address }).from.toLowerCase(),
      eventType: "split",
      amount: event.params.amount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      collateral: collateralForSplitMerge(full, event.params.collateralToken as Address),
      transactionHash: (event.transaction as { hash: string }).hash.toLowerCase(),
    });
  }
);

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PositionsMerge" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const conditionId = entityId(chainId, qid(event.params.conditionId as `0x${string}`));
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;
    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    for (const mid of condition.marketIds) {
      const market = await context.Market.get(mid);
      if (!market) continue;
      if (market.parentCollectionId === parentCol) {
        context.Market.set({
          ...market,
          outcomesSupply: market.outcomesSupply - event.params.amount,
          updatedAt: event.block.timestamp,
        });
      }
    }
    const input = (event.transaction as { input?: `0x${string}` }).input;
    const market = await getMarketFromTx(context, chainId, input, mergeMethods);
    if (!market) return;
    const full = await context.Market.get(market.id);
    if (!full) return;
    const id = entityId(
      chainId,
      `${(event.transaction as { hash: string }).hash.toLowerCase()}-${event.logIndex}`,
    );
    context.ConditionalEvent.set({
      id,
      chainId: BigInt(chainId),
      market_id: full.id,
      accountId: (event.transaction as { from: Address }).from.toLowerCase(),
      eventType: "merge",
      amount: event.params.amount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      collateral: collateralForSplitMerge(full, event.params.collateralToken as Address),
      transactionHash: (event.transaction as { hash: string }).hash.toLowerCase(),
    });
  }
);

indexer.onEvent(
  { contract: "ConditionalTokens", event: "PayoutRedemption" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const conditionId = entityId(chainId, qid(event.params.conditionId as `0x${string}`));
    const condition = await context.Condition.get(conditionId);
    if (!condition) return;
    const parentCol = (event.params.parentCollectionId as `0x${string}`).toLowerCase();
    for (const mid of condition.marketIds) {
      const market = await context.Market.get(mid);
      if (!market) continue;
      if (market.parentCollectionId === parentCol) {
        context.Market.set({
          ...market,
          outcomesSupply: market.outcomesSupply - event.params.payout,
          updatedAt: event.block.timestamp,
        });
      }
    }
    const input = (event.transaction as { input?: `0x${string}` }).input;
    const market = await getMarketFromTx(context, chainId, input, redeemMethods);
    if (!market) return;
    const full = await context.Market.get(market.id);
    if (!full) return;
    const id = entityId(
      chainId,
      `${(event.transaction as { hash: string }).hash.toLowerCase()}-${event.logIndex}`,
    );
    context.ConditionalEvent.set({
      id,
      chainId: BigInt(chainId),
      market_id: full.id,
      accountId: (event.transaction as { from: Address }).from.toLowerCase(),
      eventType: "redeem",
      amount: event.params.payout,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      collateral: collateralForSplitMerge(full, event.params.collateralToken as Address),
      transactionHash: (event.transaction as { hash: string }).hash.toLowerCase(),
    });
  }
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
  }
);
