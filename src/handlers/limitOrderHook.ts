// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import {
  addParticipant,
  ensurePool,
  loadOrCreateOrderLevel,
  loadOrCreateUserOrder,
  removeParticipant,
  saveCancelEvent,
  saveFillEvent,
  savePlaceEvent,
  saveWithdrawEvent,
  updateOrderLevelPrices,
} from "../limitOrder/entities";
import {
  orderLevelId,
  userOrderId,
  type PoolKey,
} from "../limitOrder/poolId";

function poolKeyFromParams(key: {
  currency0: Address;
  currency1: Address;
  fee: number | bigint;
  tickSpacing: number | bigint;
  hooks: Address;
}): PoolKey {
  return {
    currency0: key.currency0,
    currency1: key.currency1,
    fee: Number(key.fee),
    tickSpacing: Number(key.tickSpacing),
    hooks: key.hooks,
  };
}

function eventMeta(event: {
  chainId: number | bigint;
  block: { number: number | bigint; timestamp: number | bigint };
  transaction: { hash: string };
  logIndex: number;
}) {
  return {
    chainId: Number(event.chainId),
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    logIndex: event.logIndex,
  };
}

indexer.onEvent(
  { contract: "LimitOrderHook", event: "Place" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const key = poolKeyFromParams(event.params.key);
    const pool = await ensurePool(
      context,
      chainId,
      key,
      BigInt(event.block.number),
      BigInt(event.block.timestamp)
    );
    if (!pool) return;

    const tickLower = Number(event.params.tickLower);
    const zeroForOne = Boolean(event.params.zeroForOne);
    const orderId = BigInt(event.params.orderId);
    const liquidity = BigInt(event.params.liquidity);
    const owner = event.params.owner as Address;

    let level = await loadOrCreateOrderLevel(
      context,
      pool,
      orderId,
      tickLower,
      zeroForOne,
      BigInt(event.block.number)
    );
    level = {
      ...level,
      liquidityTotal: level.liquidityTotal + liquidity,
      participants: addParticipant(level.participants, owner),
    };
    context.OrderLevel.set(level);

    let userOrder = await loadOrCreateUserOrder(
      context,
      pool,
      orderId,
      owner,
      tickLower,
      zeroForOne,
      BigInt(event.block.number)
    );
    userOrder = {
      ...userOrder,
      liquidity: userOrder.liquidity + liquidity,
      status: "OPEN",
    };
    context.UserOrder.set(userOrder);

    savePlaceEvent(
      context,
      eventMeta(event),
      orderId,
      pool,
      owner,
      tickLower,
      zeroForOne,
      liquidity
    );
  }
);

indexer.onEvent(
  { contract: "LimitOrderHook", event: "Fill" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const key = poolKeyFromParams(event.params.key);
    const pool = await ensurePool(
      context,
      chainId,
      key,
      BigInt(event.block.number),
      BigInt(event.block.timestamp)
    );
    if (!pool) return;

    const tickLower = Number(event.params.tickLower);
    const zeroForOne = Boolean(event.params.zeroForOne);
    const orderId = BigInt(event.params.orderId);
    const levelId = orderLevelId(
      chainId,
      pool.poolId as `0x${string}`,
      tickLower,
      zeroForOne
    );
    const level = await context.OrderLevel.get(levelId);
    if (level) {
      for (const participant of level.participants) {
        const uo = await context.UserOrder.get(
          userOrderId(chainId, orderId, participant as Address)
        );
        if (uo) {
          context.UserOrder.set({
            ...uo,
            status: "FILLED",
            updatedAtBlock: BigInt(event.block.number),
          });
        }
      }

      let updated = {
        ...level,
        liquidityTotal: 0n,
        updatedAtBlock: BigInt(event.block.number),
      };
      updated = await updateOrderLevelPrices(context, updated, pool);
      context.OrderLevel.set(updated);
    }

    saveFillEvent(
      context,
      eventMeta(event),
      orderId,
      pool,
      tickLower,
      zeroForOne
    );
  }
);

indexer.onEvent(
  { contract: "LimitOrderHook", event: "Cancel" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const key = poolKeyFromParams(event.params.key);
    const pool = await ensurePool(
      context,
      chainId,
      key,
      BigInt(event.block.number),
      BigInt(event.block.timestamp)
    );
    if (!pool) return;

    const tickLower = Number(event.params.tickLower);
    const zeroForOne = Boolean(event.params.zeroForOne);
    const orderId = BigInt(event.params.orderId);
    const liquidity = BigInt(event.params.liquidity);
    const owner = event.params.owner as Address;

    let level = await loadOrCreateOrderLevel(
      context,
      pool,
      orderId,
      tickLower,
      zeroForOne,
      BigInt(event.block.number)
    );
    level = {
      ...level,
      liquidityTotal: level.liquidityTotal - liquidity,
    };

    const userOrder = await context.UserOrder.get(
      userOrderId(chainId, orderId, owner)
    );
    if (userOrder) {
      level = {
        ...level,
        participants: removeParticipant(level.participants, owner),
      };
      context.UserOrder.set({
        ...userOrder,
        liquidity: 0n,
        status: "CANCELLED",
        updatedAtBlock: BigInt(event.block.number),
      });
    }
    context.OrderLevel.set(level);

    saveCancelEvent(
      context,
      eventMeta(event),
      orderId,
      pool,
      owner,
      tickLower,
      zeroForOne,
      liquidity
    );
  }
);

indexer.onEvent(
  { contract: "LimitOrderHook", event: "Withdraw" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const orderId = BigInt(event.params.orderId);
    const owner = event.params.owner as Address;
    const liquidity = BigInt(event.params.liquidity);

    const userOrder = await context.UserOrder.get(
      userOrderId(chainId, orderId, owner)
    );
    if (!userOrder) return;

    const pool = await context.LimitOrderPool.get(userOrder.pool_id);
    if (!pool) return;

    let nextLiquidity =
      userOrder.liquidity >= liquidity
        ? userOrder.liquidity - liquidity
        : 0n;

    context.UserOrder.set({
      ...userOrder,
      liquidity: nextLiquidity,
      status: nextLiquidity === 0n ? "WITHDRAWN" : userOrder.status,
      updatedAtBlock: BigInt(event.block.number),
    });

    saveWithdrawEvent(
      context,
      eventMeta(event),
      orderId,
      pool,
      owner,
      userOrder.tickLower,
      userOrder.zeroForOne,
      liquidity
    );
  }
);
