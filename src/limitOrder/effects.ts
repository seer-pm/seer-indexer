import { createEffect, S } from "envio";
import type { Hex } from "viem";
import { getStateViewAddress } from "../addresses";
import { getPublicClient } from "../chain";
import StateViewAbi from "../../abis/StateView.json";

/** Read current tick from Uniswap V4 StateView.getSlot0. Returns null on failure. */
export const getSlot0TickEffect = createEffect(
  {
    name: "getSlot0Tick",
    input: {
      chainId: S.number,
      poolId: S.string,
    },
    output: S.union([S.number, null]),
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const stateView = getStateViewAddress(input.chainId);
    if (!stateView) {
      return null;
    }
    try {
      const client = getPublicClient(input.chainId);
      const result = (await client.readContract({
        address: stateView,
        abi: StateViewAbi as readonly unknown[],
        functionName: "getSlot0",
        args: [input.poolId as Hex],
      })) as readonly [bigint, number, number, number];
      return Number(result[1]);
    } catch {
      return null;
    }
  }
);
