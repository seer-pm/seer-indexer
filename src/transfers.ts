// @ts-nocheck — Envio handler registration infers event/context as any until upstream fixes generated typings.
import { MainCollateral, OutcomeToken, SerLpp } from "generated";
import type { Address } from "viem";
import { getConditionalTokensAddress, getMainCollateralAddress, getRouterAddress } from "./addresses";
import { entityId } from "./entityIds";

function addrLower(a: Address | string): `0x${string}` {
  return (a as string).toLowerCase() as `0x${string}`;
}

async function ensureToken(context: any, tokenAddress: `0x${string}`): Promise<void> {
  const existing = await context.Token.get(tokenAddress);
  if (existing) return;
  context.Token.set({ id: tokenAddress });
}

async function saveTransfer(event: any, context: any): Promise<void> {
  const chainId = Number(event.chainId);
  const tokenAddress = addrLower(event.srcAddress);
  await ensureToken(context, tokenAddress);

  const txHash = (event.transaction as { hash: string }).hash?.toLowerCase();
  const id = entityId(chainId, `${txHash}-${event.logIndex}`);

  context.Transfer.set({
    id,
    chainId: BigInt(chainId),
    token_id: tokenAddress,
    from: addrLower(event.params.from),
    to: addrLower(event.params.to),
    value: event.params.value,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    transactionHash: txHash,
    logIndex: BigInt(event.logIndex),
  });
}

function shouldIndexMainCollateralTransfer(event: any): boolean {
  const chainId = Number(event.chainId);
  const mainCollateral = getMainCollateralAddress(chainId);
  const router = getRouterAddress(chainId);
  if (!mainCollateral || !router) return false;

  const tokenAddress = addrLower(event.srcAddress);
  const isMainCollateral = tokenAddress === addrLower(mainCollateral);
  if (!isMainCollateral) return false;

  const routerAddr = addrLower(router);
  const from = addrLower(event.params.from);
  const to = addrLower(event.params.to);
  const routerInvolved = from === routerAddr || to === routerAddr;
  if (!routerInvolved) return false;

  const conditionalTokens = getConditionalTokensAddress(chainId);
  if (!conditionalTokens) return true;

  const ctf = addrLower(conditionalTokens);
  const ctfInvolved = from === ctf || to === ctf;
  if (ctfInvolved) return false;

  return true;
}

OutcomeToken.Transfer.handler(async ({ event, context }) => {
  await saveTransfer(event, context);
});

MainCollateral.Transfer.handler(async ({ event, context }) => {
  if (!shouldIndexMainCollateralTransfer(event)) return;
  await saveTransfer(event, context);
});

SerLpp.Transfer.handler(async ({ event, context }) => {
  await saveTransfer(event, context);
});

