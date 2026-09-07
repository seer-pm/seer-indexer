import { addrLower, isSeerRouterAddress } from "./transferBalances";

/**
 * The account a split / merge / redeem belongs to.
 *
 * The CTF names a `stakeholder` (or `redeemer`). When that is not the Seer router the caller went
 * to the CTF directly and the stakeholder is the account. When it *is* the router, the router acted
 * for whoever called it — the router pulls and pays collateral against its own `msg.sender` — and
 * that party is not in the event. It is the transaction's `to`: the contract the signer called, which
 * is what then called the router. Only when the signer called the router itself (`to` is the router)
 * is the account the signer.
 *
 * `transaction.from` was the previous answer, and it names the wrong party whenever a contract sits
 * between signer and router:
 *
 * - a DeepFunding `TradeExecutor` holds the positions and its owner's collateral. It is callable by
 *   the owner or by a temporary session key (`setTemporaryPermission`), and the app's agent flow signs
 *   with such a key, so `from` is a throwaway EOA that never held anything.
 * - a Safe or any other contract wallet holds the positions; `from` is one of its signers.
 *
 * Its executor has an immutable owner and acts only for that owner, so booking the leg to the
 * executor lets readers roll it up to the owner. `to` is empty for a contract-creation transaction,
 * where the only party is the deployer, so that falls back to `from`.
 *
 * Not covered: a forwarder, module or multicall between `to` and the router. There `to` is the
 * intermediary, and no transaction field names the router's real `msg.sender`; that would take the
 * same-transaction collateral transfer, which is not visible from the CTF handler for merge / redeem.
 */
export function resolveAccountId(
  chainId: number,
  onChainParty: `0x${string}`,
  transaction: { from: `0x${string}`; to?: string | null },
): `0x${string}` {
  const party = addrLower(onChainParty);
  if (!isSeerRouterAddress(chainId, party)) return party;

  const to = transaction.to ? addrLower(transaction.to) : null;
  if (!to || isSeerRouterAddress(chainId, to)) return addrLower(transaction.from);
  return to;
}
