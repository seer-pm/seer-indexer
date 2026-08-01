import {
  encodeAbiParameters,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { entityId } from "../entityIds";

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export function sortCurrencies(a: Address, b: Address): [Address, Address] {
  return a.toLowerCase() < b.toLowerCase()
    ? [a.toLowerCase() as Address, b.toLowerCase() as Address]
    : [b.toLowerCase() as Address, a.toLowerCase() as Address];
}

/** Uniswap V4 poolId = keccak256(abi.encode(sorted currencies, fee, tickSpacing, hooks)). */
export function computePoolId(key: PoolKey): Hex {
  const [currency0, currency1] = sortCurrencies(key.currency0, key.currency1);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [currency0, currency1, key.fee, key.tickSpacing, key.hooks]
    )
  );
}

export function limitOrderPoolEntityId(chainId: number, poolId: Hex): string {
  return entityId(chainId, poolId);
}

export function orderLevelId(
  chainId: number,
  poolId: Hex,
  tickLower: number,
  zeroForOne: boolean
): string {
  return `${chainId}:${poolId.toLowerCase()}-${tickLower}-${zeroForOne ? "true" : "false"}`;
}

export function userOrderId(
  chainId: number,
  orderId: bigint,
  owner: Address
): string {
  return `${chainId}:${orderId.toString()}-${owner.toLowerCase()}`;
}

export function orderEventId(
  chainId: number,
  txHash: string,
  logIndex: number
): string {
  return `${chainId}:${txHash.toLowerCase()}-${logIndex}`;
}
