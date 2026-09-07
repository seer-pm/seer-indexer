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
    // Bounded batching. contractRegister fires one getMarket per NewMarket in a
    // HyperSync response, all in the same tick, so viem packs them into a single
    // JSON-RPC request. A sparse query can hand us a chain's entire factory
    // history at once — 520 markets on optimism — and getMarket averages ~44KB
    // per market there, so that batch is ~22MiB of response. It blew past the
    // provider's 10MiB body cap (~235 calls is enough), failing the whole batch
    // and every retry of it. 25 keeps a batch near 1MiB.
    transport: http(url, { batch: { batchSize: 25 } }),
  });
  clients.set(chainId, client);
  return client;
}
