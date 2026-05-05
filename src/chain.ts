import { createPublicClient, http, type Chain } from "viem";
import { base, gnosis, mainnet, optimism, sepolia } from "viem/chains";

const CHAINS: Record<number, Chain> = {
  100: gnosis,
  1: mainnet,
  10: optimism,
  8453: base,
  11155111: sepolia,
};

const clients = new Map<number, unknown>();

function optionalIndexerRpcUrl(chainId: number): string | undefined {
  const v = process.env[`ENVIO_INDEXER_RPC_${chainId}`]?.trim();
  return v || undefined;
}

/** viem Client; typed loosely to avoid duplicate viem installs vs envio's bundled viem. */
export function getPublicClient(chainId: number): any {
  const hit = clients.get(chainId);
  if (hit) return hit;
  const chain = CHAINS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId ${chainId} for RPC reads`);
  }
  const url = optionalIndexerRpcUrl(chainId);
  const client = createPublicClient({
    chain,
    transport: http(url, { batch: true }),
  });
  clients.set(chainId, client);
  return client;
}
