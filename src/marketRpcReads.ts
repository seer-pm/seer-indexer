/**
 * Direct RPC reads (viem). Used by createEffect wrappers and by contractRegister,
 * which does not expose context.effect.
 */
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { getPublicClient } from "./chain";
import { getMarketViewAddress } from "./addresses";
import MarketViewAbi from "../abis/MarketView.json";
import MarketFactoryAbi from "../abis/MarketFactory.json";
import FutarchyFactoryAbi from "../abis/FutarchyFactory.json";
import FutarchyProposalAbi from "../abis/FutarchyProposal.json";
import RealityAbi from "../abis/Realitiy.json";
import type { MarketProcessInput, QuestionRow } from "./marketsLogic";

export async function fetchGenericMarketDataRaw(
  chainId: number,
  blockNumber: bigint,
  factoryAddress: Address,
  marketAddress: Address,
): Promise<MarketProcessInput> {
  const client = getPublicClient(chainId);
  const view = getMarketViewAddress(chainId);
  const data = (await client.readContract({
    address: view,
    abi: MarketViewAbi as readonly unknown[],
    functionName: "getMarket",
    args: [factoryAddress, marketAddress],
    blockNumber,
  })) as {
    id: Address;
    marketName: string;
    outcomes: string[];
    parentMarket: Address;
    parentOutcome: bigint;
    wrappedTokens: Address[];
    outcomesSupply: bigint;
    lowerBound: bigint;
    upperBound: bigint;
    parentCollectionId: `0x${string}`;
    conditionId: `0x${string}`;
    questionId: `0x${string}`;
    templateId: bigint;
    questions: {
      content_hash: `0x${string}`;
      arbitrator: Address;
      opening_ts: number;
      timeout: number;
      finalize_ts: number;
      is_pending_arbitration: boolean;
      bounty: bigint;
      best_answer: `0x${string}`;
      history_hash: `0x${string}`;
      bond: bigint;
      min_bond: bigint;
    }[];
    questionsIds: `0x${string}`[];
    encodedQuestions: string[];
    payoutReported: boolean;
  };

  const questions: QuestionRow[] = data.questions.map((q) => ({
    opening_ts: BigInt(q.opening_ts),
    arbitrator: q.arbitrator,
    timeout: BigInt(q.timeout),
    finalize_ts: BigInt(q.finalize_ts),
    is_pending_arbitration: q.is_pending_arbitration,
    best_answer: q.best_answer,
    bond: q.bond,
    min_bond: q.min_bond,
  }));

  return {
    id: marketAddress.toLowerCase(),
    marketType: "Generic",
    marketName: data.marketName,
    outcomes: data.outcomes,
    lowerBound: data.lowerBound,
    upperBound: data.upperBound,
    parentCollectionId: data.parentCollectionId,
    parentOutcome: data.parentOutcome,
    parentMarket: data.parentMarket,
    collateralToken1: zeroAddress,
    collateralToken2: zeroAddress,
    wrappedTokens: data.wrappedTokens,
    conditionId: data.conditionId,
    questionId: data.questionId,
    questionsIds: data.questionsIds.map((x) => x.toLowerCase() as `0x${string}`),
    templateId: data.templateId,
    encodedQuestions: data.encodedQuestions,
    questions,
  };
}

export async function readCollateralTokenRaw(
  chainId: number,
  blockNumber: bigint,
  factoryAddress: Address,
): Promise<Address> {
  const client = getPublicClient(chainId);
  return client.readContract({
    address: factoryAddress,
    abi: MarketFactoryAbi as readonly unknown[],
    functionName: "collateralToken",
    blockNumber,
  }) as Promise<Address>;
}

export async function fetchFutarchyMarketDataRaw(
  chainId: number,
  blockNumber: bigint,
  futarchyFactory: Address,
  proposal: Address,
  marketName: string,
  conditionId: `0x${string}`,
  questionId: `0x${string}`,
): Promise<MarketProcessInput> {
  const client = getPublicClient(chainId);
  const outcomes: string[] = [];
  const wrappedTokens: Address[] = [];
  for (let i = 0; i < 4; i++) {
    const o = (await client.readContract({
      address: proposal,
      abi: FutarchyProposalAbi as readonly unknown[],
      functionName: "outcomes",
      args: [BigInt(i)],
      blockNumber,
    })) as string;
    outcomes.push(o);
    const wo = (await client.readContract({
      address: proposal,
      abi: FutarchyProposalAbi as readonly unknown[],
      functionName: "wrappedOutcome",
      args: [BigInt(i)],
      blockNumber,
    })) as readonly [Address, `0x${string}`];
    wrappedTokens.push(wo[0]);
  }
  const realitio = (await client.readContract({
    address: futarchyFactory,
    abi: FutarchyFactoryAbi as readonly unknown[],
    functionName: "realitio",
    blockNumber,
  })) as Address;

  const q = (await client.readContract({
    address: realitio,
    abi: RealityAbi as readonly unknown[],
    functionName: "questions",
    args: [questionId],
    blockNumber,
  })) as readonly [
    `0x${string}`,
    Address,
    number,
    number,
    number,
    boolean,
    bigint,
    `0x${string}`,
    `0x${string}`,
    bigint,
    bigint,
  ];

  const encodedQuestion = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "encodedQuestion",
    blockNumber,
  })) as string;

  const parentCollectionId = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "parentCollectionId",
    blockNumber,
  })) as `0x${string}`;
  const parentOutcome = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "parentOutcome",
    blockNumber,
  })) as bigint;
  const parentMarket = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "parentMarket",
    blockNumber,
  })) as Address;
  const ct1 = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "collateralToken1",
    blockNumber,
  })) as Address;
  const ct2 = (await client.readContract({
    address: proposal,
    abi: FutarchyProposalAbi as readonly unknown[],
    functionName: "collateralToken2",
    blockNumber,
  })) as Address;

  const questionRow: QuestionRow = {
    opening_ts: BigInt(q[2]),
    arbitrator: q[1],
    timeout: BigInt(q[3]),
    finalize_ts: BigInt(q[4]),
    is_pending_arbitration: q[5],
    best_answer: q[7],
    bond: q[9],
    min_bond: q[10],
  };

  return {
    id: proposal.toLowerCase(),
    marketType: "Futarchy",
    marketName,
    outcomes,
    lowerBound: 0n,
    upperBound: 0n,
    collateralToken1: ct1,
    collateralToken2: ct2,
    parentCollectionId,
    parentOutcome,
    parentMarket,
    wrappedTokens,
    conditionId,
    questionId,
    questionsIds: [questionId.toLowerCase() as `0x${string}`],
    templateId: 2n,
    encodedQuestions: [encodedQuestion],
    questions: [questionRow],
  };
}
