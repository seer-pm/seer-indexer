import type { Address } from "viem";
import { zeroAddress } from "viem";
import type { IndexerContext } from "./context";
import { entityId, marketsCountId } from "./entityIds";

export const DEFAULT_FINALIZE_TS = 33260976000n;

export type QuestionRow = {
  opening_ts: bigint;
  arbitrator: Address;
  timeout: bigint;
  finalize_ts: bigint;
  is_pending_arbitration: boolean;
  best_answer: `0x${string}`;
  bond: bigint;
  min_bond: bigint;
};

export type MarketProcessInput = {
  id: string;
  marketType: "Generic" | "Futarchy";
  marketName: string;
  outcomes: string[];
  lowerBound: bigint;
  upperBound: bigint;
  parentCollectionId: `0x${string}`;
  parentOutcome: bigint;
  parentMarket: Address;
  collateralToken1: Address;
  collateralToken2: Address;
  wrappedTokens: Address[];
  conditionId: `0x${string}`;
  questionId: `0x${string}`;
  questionsIds: `0x${string}`[];
  templateId: bigint;
  encodedQuestions: string[];
  questions: QuestionRow[];
};

function addrLower(a: string): string {
  return a.toLowerCase() as `0x${string}`;
}

async function getNextMarketIndex(context: IndexerContext, chainId: number): Promise<bigint> {
  const countId = marketsCountId(chainId);
  let row = await context.MarketsCount.get(countId);
  if (!row) {
    row = { id: countId, count: 0n };
  }
  const next = row.count + 1n;
  context.MarketsCount.set({ id: countId, count: next });
  return next;
}

async function getCollateralToken(
  context: IndexerContext,
  chainId: number,
  parentMarket: Address,
  parentOutcome: bigint,
  collateralToken: Address
): Promise<`0x${string}`> {
  if (parentMarket === zeroAddress || parentMarket.toLowerCase() === zeroAddress) {
    return addrLower(collateralToken) as `0x${string}`;
  }
  const market = await context.Market.get(entityId(chainId, parentMarket));
  if (!market) {
    return addrLower(collateralToken) as `0x${string}`;
  }
  const idx = Number(parentOutcome);
  const wt = market.wrappedTokens[idx];
  return (wt ? wt.toLowerCase() : collateralToken.toLowerCase()) as `0x${string}`;
}

export async function processMarket(
  context: IndexerContext,
  meta: {
    chainId: number;
    factory: string;
    creator: string;
    txHash: string;
    blockNumber: bigint;
    blockTimestamp: bigint;
  },
  data: MarketProcessInput,
  collateralToken: Address
): Promise<void> {
  const chainId = meta.chainId;
  const addressLower = data.id.toLowerCase();
  const marketId = entityId(chainId, addressLower);
  const rawConditionId = data.conditionId.toLowerCase();
  const conditionIdKey = entityId(chainId, rawConditionId);

  const condPrev = await context.Condition.get(conditionIdKey);
  const nextMarketIds = [...(condPrev?.marketIds ?? [])];
  if (!nextMarketIds.includes(marketId)) {
    nextMarketIds.push(marketId);
  }
  context.Condition.set({
    id: conditionIdKey,
    conditionId: rawConditionId as `0x${string}`,
    marketIds: nextMarketIds,
  });

  const parentId =
    data.parentMarket === zeroAddress || data.parentMarket.toLowerCase() === zeroAddress
      ? undefined
      : entityId(chainId, data.parentMarket);

  const ct = await getCollateralToken(context, chainId, data.parentMarket, data.parentOutcome, collateralToken);

  const marketEntity = {
    id: marketId,
    chainId: BigInt(chainId),
    address: addressLower as `0x${string}`,
    marketType: data.marketType === "Futarchy" ? ("Futarchy" as const) : ("Generic" as const),
    factory: addrLower(meta.factory),
    creator: addrLower(meta.creator),
    marketName: data.marketName,
    outcomes: data.outcomes,
    outcomesSupply: 0n,
    lowerBound: data.lowerBound,
    upperBound: data.upperBound,
    parentCollectionId: data.parentCollectionId.toLowerCase(),
    parentOutcome: data.parentOutcome,
    parentMarket_id: parentId,
    wrappedTokens: data.wrappedTokens.map((w) => w.toLowerCase() as `0x${string}`),
    collateralToken: ct,
    collateralToken1: addrLower(data.collateralToken1) as `0x${string}`,
    collateralToken2: addrLower(data.collateralToken2) as `0x${string}`,
    conditionId: data.conditionId.toLowerCase() as `0x${string}`,
    ctfCondition_id: conditionIdKey,
    questionId: data.questionId.toLowerCase() as `0x${string}`,
    templateId: data.templateId,
    encodedQuestions: data.encodedQuestions,
    payoutReported: false,
    payoutNumerators: data.outcomes.map(() => 0n),
    openingTs: 0n,
    finalizeTs: DEFAULT_FINALIZE_TS,
    questionsInArbitration: 0n,
    hasAnswers: false,
    index: await getNextMarketIndex(context, chainId),
    blockNumber: meta.blockNumber,
    blockTimestamp: meta.blockTimestamp,
    transactionHash: meta.txHash.toLowerCase() as `0x${string}`,
    updatedAt: meta.blockTimestamp,
  };

  let openingTs = 0n;
  const mqIds: string[] = [];
  for (let i = 0; i < data.questionsIds.length; i++) {
    const qRow = data.questions[i];
    if (i === 0) {
      openingTs = qRow.opening_ts;
    }
    const qidRaw = data.questionsIds[i].toLowerCase();
    const questionKey = entityId(chainId, qidRaw);
    const mqId = `${marketId}${questionKey}${i}`;
    mqIds.push(mqId);
    const prevQ = await context.Question.get(questionKey);
    const prevMqIds = prevQ?.marketQuestionIds ?? [];
    const nextQmq = prevMqIds.includes(mqId) ? prevMqIds : [...prevMqIds, mqId];
    context.Question.set({
      id: questionKey,
      questionId: qidRaw as `0x${string}`,
      index: i,
      arbitrator: addrLower(qRow.arbitrator) as `0x${string}`,
      opening_ts: qRow.opening_ts,
      timeout: qRow.timeout,
      finalize_ts: qRow.finalize_ts,
      is_pending_arbitration: qRow.is_pending_arbitration,
      best_answer: qRow.best_answer.toLowerCase() as `0x${string}`,
      bond: qRow.bond,
      min_bond: qRow.min_bond,
      arbitration_occurred: false,
      marketQuestionIds: nextQmq,
    });
    context.MarketQuestion.set({
      id: mqId,
      market_id: marketId,
      baseQuestion_id: questionKey,
      question_id: questionKey,
      index: i,
    });
  }

  context.Market.set({
    ...marketEntity,
    openingTs,
    marketQuestionIds: mqIds,
  });

  for (const wt of data.wrappedTokens) {
    const token = addrLower(wt) as `0x${string}`;
    context.OutcomeTokenMarket.set({
      id: entityId(chainId, token),
      chainId: BigInt(chainId),
      token,
      market_id: marketId,
    });
  }
}
