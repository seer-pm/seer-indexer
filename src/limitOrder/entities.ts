import type { Address, Hex } from "viem";
import { BigDecimal } from "envio";
import type { IndexerContext } from "../context";
import { getLimitOrderHookAddress } from "../addresses";
import { getSlot0TickEffect } from "./effects";
import { SIDE_UNKNOWN } from "./constants";
import { getOrderSide } from "./orderSide";
import {
  computePoolId,
  limitOrderPoolEntityId,
  orderEventId,
  orderLevelId,
  sortCurrencies,
  userOrderId,
  type PoolKey,
} from "./poolId";
import { tickToTokenPrices } from "./tickPrice";

export type LimitOrderPoolEntity = {
  id: string;
  chainId: bigint;
  poolId: string;
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
  initialized: boolean;
  createdAtBlock: bigint;
  createdAtTimestamp: bigint;
};

export type OrderLevelEntity = {
  id: string;
  chainId: bigint;
  pool_id: string;
  orderId: bigint;
  tickLower: number;
  zeroForOne: boolean;
  liquidityTotal: bigint;
  price0AtTick: BigDecimal;
  price1AtTick: BigDecimal;
  side: string;
  updatedAtBlock: bigint;
  participants: string[];
};

export type UserOrderEntity = {
  id: string;
  chainId: bigint;
  orderId: bigint;
  owner: string;
  pool_id: string;
  tickLower: number;
  zeroForOne: boolean;
  liquidity: bigint;
  status: "OPEN" | "FILLED" | "WITHDRAWN" | "CANCELLED";
  placedAtBlock: bigint;
  updatedAtBlock: bigint;
};

export function isValidPoolKey(chainId: number, key: PoolKey): boolean {
  const expected = getLimitOrderHookAddress(chainId);
  if (!expected) return false;
  return key.hooks.toLowerCase() === expected.toLowerCase();
}

export async function ensurePool(
  context: IndexerContext,
  chainId: number,
  key: PoolKey,
  blockNumber: bigint,
  timestamp: bigint
): Promise<LimitOrderPoolEntity | undefined> {
  if (!isValidPoolKey(chainId, key)) {
    return undefined;
  }

  const poolIdHex = computePoolId(key);
  const id = limitOrderPoolEntityId(chainId, poolIdHex);
  const existing = await context.LimitOrderPool.get(id);
  if (existing) {
    return existing as LimitOrderPoolEntity;
  }

  const [currency0, currency1] = sortCurrencies(key.currency0, key.currency1);
  const pool: LimitOrderPoolEntity = {
    id,
    chainId: BigInt(chainId),
    poolId: poolIdHex.toLowerCase(),
    currency0: currency0.toLowerCase(),
    currency1: currency1.toLowerCase(),
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: key.hooks.toLowerCase(),
    initialized: true,
    createdAtBlock: blockNumber,
    createdAtTimestamp: timestamp,
  };
  context.LimitOrderPool.set(pool);
  return pool;
}

async function resolveOrderSide(
  context: IndexerContext,
  chainId: number,
  poolId: Hex,
  tickLower: number,
  zeroForOne: boolean,
  tickSpacing: number
): Promise<string> {
  const currentTick = (await context.effect(getSlot0TickEffect, {
    chainId,
    poolId: poolId.toLowerCase(),
  })) as number | null;
  return getOrderSide(tickLower, zeroForOne, tickSpacing, currentTick);
}

export async function updateOrderLevelPrices(
  context: IndexerContext,
  level: OrderLevelEntity,
  pool: LimitOrderPoolEntity
): Promise<OrderLevelEntity> {
  const [price0, price1] = tickToTokenPrices(level.tickLower);
  const side = await resolveOrderSide(
    context,
    Number(pool.chainId),
    pool.poolId as Hex,
    level.tickLower,
    level.zeroForOne,
    pool.tickSpacing
  );
  return {
    ...level,
    price0AtTick: price0,
    price1AtTick: price1,
    side,
  };
}

export async function loadOrCreateOrderLevel(
  context: IndexerContext,
  pool: LimitOrderPoolEntity,
  orderId: bigint,
  tickLower: number,
  zeroForOne: boolean,
  blockNumber: bigint
): Promise<OrderLevelEntity> {
  const chainId = Number(pool.chainId);
  const id = orderLevelId(chainId, pool.poolId as Hex, tickLower, zeroForOne);
  let level = (await context.OrderLevel.get(id)) as OrderLevelEntity | undefined;

  if (!level) {
    level = {
      id,
      chainId: pool.chainId,
      pool_id: pool.id,
      orderId,
      tickLower,
      zeroForOne,
      liquidityTotal: 0n,
      price0AtTick: new BigDecimal(0),
      price1AtTick: new BigDecimal(0),
      side: SIDE_UNKNOWN,
      updatedAtBlock: blockNumber,
      participants: [],
    };
  }

  level = {
    ...level,
    updatedAtBlock: blockNumber,
  };
  return updateOrderLevelPrices(context, level, pool);
}

export async function loadOrCreateUserOrder(
  context: IndexerContext,
  pool: LimitOrderPoolEntity,
  orderId: bigint,
  owner: Address,
  tickLower: number,
  zeroForOne: boolean,
  blockNumber: bigint
): Promise<UserOrderEntity> {
  const chainId = Number(pool.chainId);
  const id = userOrderId(chainId, orderId, owner);
  const existing = (await context.UserOrder.get(id)) as
    | UserOrderEntity
    | undefined;

  if (existing) {
    return {
      ...existing,
      updatedAtBlock: blockNumber,
    };
  }

  return {
    id,
    chainId: pool.chainId,
    orderId,
    owner: owner.toLowerCase(),
    pool_id: pool.id,
    tickLower,
    zeroForOne,
    liquidity: 0n,
    status: "OPEN",
    placedAtBlock: blockNumber,
    updatedAtBlock: blockNumber,
  };
}

export function addParticipant(
  participants: string[],
  owner: Address
): string[] {
  const lower = owner.toLowerCase();
  if (participants.some((p) => p.toLowerCase() === lower)) {
    return participants;
  }
  return [...participants, lower];
}

export function removeParticipant(
  participants: string[],
  owner: Address
): string[] {
  const lower = owner.toLowerCase();
  return participants.filter((p) => p.toLowerCase() !== lower);
}

type EventMeta = {
  chainId: number;
  blockNumber: bigint;
  timestamp: bigint;
  txHash: string;
  logIndex: number;
};

export function savePlaceEvent(
  context: IndexerContext,
  meta: EventMeta,
  orderId: bigint,
  pool: LimitOrderPoolEntity,
  owner: Address,
  tickLower: number,
  zeroForOne: boolean,
  liquidity: bigint
): void {
  context.OrderEvent.set({
    id: orderEventId(meta.chainId, meta.txHash, meta.logIndex),
    chainId: BigInt(meta.chainId),
    type: "PLACE",
    blockNumber: meta.blockNumber,
    timestamp: meta.timestamp,
    transactionHash: meta.txHash.toLowerCase(),
    owner: owner.toLowerCase(),
    orderId,
    pool_id: pool.id,
    tickLower,
    zeroForOne,
    liquidity,
  });
}

export function saveFillEvent(
  context: IndexerContext,
  meta: EventMeta,
  orderId: bigint,
  pool: LimitOrderPoolEntity,
  tickLower: number,
  zeroForOne: boolean
): void {
  context.OrderEvent.set({
    id: orderEventId(meta.chainId, meta.txHash, meta.logIndex),
    chainId: BigInt(meta.chainId),
    type: "FILL",
    blockNumber: meta.blockNumber,
    timestamp: meta.timestamp,
    transactionHash: meta.txHash.toLowerCase(),
    orderId,
    pool_id: pool.id,
    tickLower,
    zeroForOne,
  });
}

export function saveCancelEvent(
  context: IndexerContext,
  meta: EventMeta,
  orderId: bigint,
  pool: LimitOrderPoolEntity,
  owner: Address,
  tickLower: number,
  zeroForOne: boolean,
  liquidity: bigint
): void {
  context.OrderEvent.set({
    id: orderEventId(meta.chainId, meta.txHash, meta.logIndex),
    chainId: BigInt(meta.chainId),
    type: "CANCEL",
    blockNumber: meta.blockNumber,
    timestamp: meta.timestamp,
    transactionHash: meta.txHash.toLowerCase(),
    owner: owner.toLowerCase(),
    orderId,
    pool_id: pool.id,
    tickLower,
    zeroForOne,
    liquidity,
  });
}

export function saveWithdrawEvent(
  context: IndexerContext,
  meta: EventMeta,
  orderId: bigint,
  pool: LimitOrderPoolEntity,
  owner: Address,
  tickLower: number,
  zeroForOne: boolean,
  liquidity: bigint
): void {
  context.OrderEvent.set({
    id: orderEventId(meta.chainId, meta.txHash, meta.logIndex),
    chainId: BigInt(meta.chainId),
    type: "WITHDRAW",
    blockNumber: meta.blockNumber,
    timestamp: meta.timestamp,
    transactionHash: meta.txHash.toLowerCase(),
    owner: owner.toLowerCase(),
    orderId,
    pool_id: pool.id,
    tickLower,
    zeroForOne,
    liquidity,
  });
}
