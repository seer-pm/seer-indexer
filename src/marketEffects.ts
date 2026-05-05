import { createEffect, S } from "envio";
import type { Address } from "viem";
import {
  fetchFutarchyMarketDataRaw,
  fetchGenericMarketDataRaw,
  readCollateralTokenRaw,
} from "./marketRpcReads";
import { stringifyWithBigInt } from "./marketSerde";

export const fetchGenericMarketDataEffect = createEffect(
  {
    name: "fetchGenericMarketData_v2",
    input: {
      chainId: S.number,
      blockNumber: S.bigint,
      factoryAddress: S.string,
      marketAddress: S.string,
    },
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const data = await fetchGenericMarketDataRaw(
      input.chainId,
      input.blockNumber,
      input.factoryAddress as Address,
      input.marketAddress as Address,
    );
    return stringifyWithBigInt(data);
  },
);

export const readCollateralTokenEffect = createEffect(
  {
    name: "readCollateralToken_v2",
    input: {
      chainId: S.number,
      blockNumber: S.bigint,
      factoryAddress: S.string,
    },
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const addr = await readCollateralTokenRaw(
      input.chainId,
      input.blockNumber,
      input.factoryAddress as Address,
    );
    return addr as string;
  },
);

export const fetchFutarchyMarketDataEffect = createEffect(
  {
    name: "fetchFutarchyMarketData_v2",
    input: {
      chainId: S.number,
      blockNumber: S.bigint,
      futarchyFactory: S.string,
      proposal: S.string,
      marketName: S.string,
      conditionId: S.string,
      questionId: S.string,
    },
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input }) => {
    const data = await fetchFutarchyMarketDataRaw(
      input.chainId,
      input.blockNumber,
      input.futarchyFactory as Address,
      input.proposal as Address,
      input.marketName,
      input.conditionId as `0x${string}`,
      input.questionId as `0x${string}`,
    );
    return stringifyWithBigInt(data);
  },
);
