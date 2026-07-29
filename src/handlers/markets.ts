// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { Address } from "viem";
import {
  fetchFutarchyMarketDataEffect,
  fetchGenericMarketDataEffect,
  readCollateralTokenEffect,
} from "../marketEffects";
import {
  fetchFutarchyMarketDataRaw,
  fetchGenericMarketDataRaw,
} from "../marketRpcReads";
import { processMarket } from "../marketsLogic";
import { parseMarketProcessInput } from "../marketSerde";

indexer.onEvent(
  { contract: "MarketFactory", event: "NewMarket" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const blockNumber = event.block.number;
    const factory = event.srcAddress as Address;
    const marketAddr = event.params.market as Address;
    const dataJson = (await context.effect(fetchGenericMarketDataEffect, {
      chainId,
      blockNumber,
      factoryAddress: factory,
      marketAddress: marketAddr,
    })) as string;
    const data = parseMarketProcessInput(dataJson);

    const collateral = (await context.effect(readCollateralTokenEffect, {
      chainId,
      blockNumber,
      factoryAddress: factory,
    })) as Address;
    await processMarket(
      context,
      {
        chainId,
        factory,
        creator: (event.transaction as { from: Address }).from,
        txHash: (event.transaction as { hash: string }).hash,
        blockNumber,
        blockTimestamp: event.block.timestamp,
      },
      data,
      collateral
    );
  }
);

indexer.contractRegister(
  { contract: "MarketFactory", event: "NewMarket" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const blockNumber = event.block.number;
    const factory = event.srcAddress as Address;
    const marketAddr = event.params.market as Address;
    const data = await fetchGenericMarketDataRaw(chainId, blockNumber, factory, marketAddr);
    for (const token of data.wrappedTokens ?? []) {
      context.chain.OutcomeToken.add(token);
    }
  }
);

indexer.onEvent(
  { contract: "FutarchyFactory", event: "NewProposal" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const blockNumber = event.block.number;
    const futarchyFactory = event.srcAddress as Address;
    const proposal = event.params.proposal as Address;
    const dataJson = (await context.effect(fetchFutarchyMarketDataEffect, {
      chainId,
      blockNumber,
      futarchyFactory,
      proposal,
      marketName: event.params.marketName,
      conditionId: event.params.conditionId,
      questionId: event.params.questionId,
    })) as string;
    const data = parseMarketProcessInput(dataJson);
    await processMarket(
      context,
      {
        chainId,
        factory: futarchyFactory,
        creator: (event.transaction as { from: Address }).from,
        txHash: (event.transaction as { hash: string }).hash,
        blockNumber,
        blockTimestamp: event.block.timestamp,
      },
      data,
      "0x0000000000000000000000000000000000000000" as Address
    );
  }
);

indexer.contractRegister(
  { contract: "FutarchyFactory", event: "NewProposal" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const blockNumber = event.block.number;
    const futarchyFactory = event.srcAddress as Address;
    const proposal = event.params.proposal as Address;
    const data = await fetchFutarchyMarketDataRaw(
      chainId,
      blockNumber,
      futarchyFactory,
      proposal,
      event.params.marketName,
      event.params.conditionId,
      event.params.questionId,
    );
    for (const token of data.wrappedTokens ?? []) {
      context.chain.OutcomeToken.add(token);
    }
  }
);
