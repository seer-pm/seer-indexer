import { SIDE_ASK, SIDE_BID, SIDE_UNKNOWN } from "./constants";

/**
 * Classify order level relative to current pool tick.
 * Uses the pool's own tickSpacing (not a hardcoded 60).
 */
export function getOrderSide(
  tickLower: number,
  zeroForOne: boolean,
  tickSpacing: number,
  currentTick: number | null
): string {
  if (currentTick === null) {
    return SIDE_UNKNOWN;
  }

  if (!zeroForOne && tickLower + tickSpacing <= currentTick) {
    return SIDE_BID;
  }
  if (zeroForOne && tickLower > currentTick) {
    return SIDE_ASK;
  }

  return SIDE_UNKNOWN;
}
