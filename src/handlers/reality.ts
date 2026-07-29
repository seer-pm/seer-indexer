// @ts-nocheck — Envio handler registration infers event/context loosely until typings settle.
import { indexer } from "envio";
import type { IndexerContext } from "../context";
import { entityId } from "../entityIds";
import { getFinalizeTs, processReopenedQuestion } from "../realityLogic";

function qid(p: `0x${string}` | string): string {
  return p.toLowerCase();
}

async function forEachQuestionMarket(
  context: IndexerContext,
  chainId: number,
  questionId: string,
  fn: (marketId: string) => Promise<void>
): Promise<void> {
  const question = await context.Question.get(entityId(chainId, questionId));
  if (!question) return;
  for (const mqId of question.marketQuestionIds) {
    const mq = await context.MarketQuestion.get(mqId);
    if (!mq) continue;
    await fn(mq.market_id);
  }
}

indexer.onEvent(
  { contract: "Reality", event: "LogNewAnswer" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const questionId = qid(event.params.question_id as `0x${string}`);
    const question = await context.Question.get(entityId(chainId, questionId));
    if (!question) return;

    const finalizeTs = question.arbitration_occurred
      ? event.params.ts
      : event.params.ts + question.timeout;

    context.Question.set({
      ...question,
      finalize_ts: finalizeTs,
      best_answer: (event.params.answer as `0x${string}`).toLowerCase() as `0x${string}`,
      bond: event.params.bond,
    });

    await forEachQuestionMarket(context, chainId, questionId, async (marketId) => {
      const market = await context.Market.get(marketId);
      if (!market) return;
      const ft = await getFinalizeTs(context, market.id);
      context.Market.set({
        ...market,
        hasAnswers: true,
        finalizeTs: ft,
        updatedAt: event.block.timestamp,
      });
    });
  }
);

indexer.onEvent(
  { contract: "Reality", event: "LogNotifyOfArbitrationRequest" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const questionId = qid(event.params.question_id as `0x${string}`);
    const question = await context.Question.get(entityId(chainId, questionId));
    if (!question) return;
    context.Question.set({ ...question, is_pending_arbitration: true });
    await forEachQuestionMarket(context, chainId, questionId, async (marketId) => {
      const market = await context.Market.get(marketId);
      if (!market) return;
      context.Market.set({
        ...market,
        questionsInArbitration: market.questionsInArbitration + 1n,
        updatedAt: event.block.timestamp,
      });
    });
  }
);

indexer.onEvent(
  { contract: "Reality", event: "LogCancelArbitration" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const questionId = qid(event.params.question_id as `0x${string}`);
    const question = await context.Question.get(entityId(chainId, questionId));
    if (!question) return;
    context.Question.set({ ...question, is_pending_arbitration: false });
    await forEachQuestionMarket(context, chainId, questionId, async (marketId) => {
      const market = await context.Market.get(marketId);
      if (!market) return;
      context.Market.set({
        ...market,
        questionsInArbitration: market.questionsInArbitration - 1n,
        updatedAt: event.block.timestamp,
      });
    });
  }
);

indexer.onEvent(
  { contract: "Reality", event: "LogFinalize" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const questionId = qid(event.params.question_id as `0x${string}`);
    const question = await context.Question.get(entityId(chainId, questionId));
    if (!question) return;
    context.Question.set({
      ...question,
      best_answer: (event.params.answer as `0x${string}`).toLowerCase() as `0x${string}`,
      is_pending_arbitration: false,
      arbitration_occurred: true,
    });
    await forEachQuestionMarket(context, chainId, questionId, async (marketId) => {
      const market = await context.Market.get(marketId);
      if (!market) return;
      context.Market.set({
        ...market,
        questionsInArbitration: market.questionsInArbitration - 1n,
        updatedAt: event.block.timestamp,
      });
    });
  }
);

indexer.onEvent(
  { contract: "Reality", event: "LogReopenQuestion" },
  async ({ event, context }) => {
    const chainId = Number(event.chainId);
    const reopened = qid(event.params.reopened_question_id as `0x${string}`);
    const newQ = qid(event.params.question_id as `0x${string}`);
    await processReopenedQuestion(context, chainId, reopened, newQ, event.block.timestamp);
  }
);
