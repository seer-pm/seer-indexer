import type { Address } from "viem";

export function getMarketViewAddress(chainId: number): Address {
  if (chainId === 11_155_111) {
    return "0x03d03464bf9eb20059ca6ef6391e9c5d79d5e012";
  }
  if (chainId === 1) {
    return "0xab797c4c6022a401c31543e316d3cd04c67a87fc";
  }
  if (chainId === 10) {
    return "0x1f728c2fd6a3008935c1446a965a313e657b7904";
  }
  if (chainId === 8453) {
    return "0x1f728c2fd6a3008935c1446a965a313e657b7904";
  }
  return "0x995dc9c89b6605a1e8cc028b37cb8e568e27626f";
}

export function getRouterAddress(chainId: number): Address | null {
  if (chainId === 100) return "0xec9048b59b3467415b1a38f63416407ea0c70fb8"; // gnosis
  if (chainId === 1) return "0x886ef0a78fabbae942f1da1791a8ed02a5af8bc6"; // mainnet
  if (chainId === 10) return "0x179d8f8c811b8c759c33809dbc6c5cedc62d05dd"; // optimism
  if (chainId === 8453) return "0x3124e97ebf4c9592a17d40e54623953ff3c77a73"; // base
  return null;
}

export function getMainCollateralAddresses(chainId: number): Address[] {
  if (chainId === 100) {
    return [
      "0xaf204776c7245bf4147c2612bf6e5972ee483701",
      "0xeef7b1f06b092625228c835dd5d5b14641d1e54a",
    ]; // gnosis
  }
  if (chainId === 1) return ["0x83f20f44975d03b1b09e64809b757c47f942beea"]; // mainnet
  if (chainId === 10) return ["0xb5b2dc7fd34c249f4be7fb1fcea07950784229e0"]; // optimism
  if (chainId === 8453) return ["0x5875eee11cf8398102fdad704c9e96607675467a"]; // base
  return [];
}

export function getConditionalTokensAddress(chainId: number): Address | null {
  // Source: indexer/config.yaml
  if (chainId === 100) return "0xceafdd6bc0bef976fdcd1112955828e00543c0ce"; // gnosis
  if (chainId === 1) return "0xc59b0e4de5f1248c1140964e0ff287b192407e0c"; // mainnet
  if (chainId === 10) return "0x8bdc504dc3a05310059c1c67e0a2667309d27b93"; // optimism
  if (chainId === 8453) return "0xab797c4c6022a401c31543e316d3cd04c67a87fc"; // base
  return null;
}

export function getLimitOrderHookAddress(chainId: number): Address | null {
  if (chainId === 1) return "0xe10a429d18e90fbd44be3678d2ae1ef3c1691040";
  if (chainId === 10) return "0x1f78e79c20d1e77526ac21e3651fabfc22035040";
  if (chainId === 8453) return "0x19e8b37e9f4d69927da1e13e989a2f955ee39040";
  return null;
}

/** Uniswap V4 StateView (canonical per-chain). */
export function getStateViewAddress(chainId: number): Address | null {
  if (chainId === 1) return "0x7ffe42c4a5deea5b0fec41c94c136cf115597227";
  if (chainId === 10) return "0xc18a3169788f4f75a170290584eca6395c75ecdb";
  if (chainId === 8453) return "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
  return null;
}
