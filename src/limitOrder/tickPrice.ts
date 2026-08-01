import { BigDecimal } from "envio";

const Q192 = new BigDecimal(
  "6277101735386680763835789423207666416102355444464034512896"
);
const ZERO_BD = new BigDecimal(0);
const ONE_BD = new BigDecimal(1);

function mulShift(val: bigint, mul: bigint): bigint {
  return (val * mul) >> 128n;
}

/**
 * Port of Uniswap TickMath.getSqrtRatioAtTick.
 * Returns sqrt(1.0001^tick) * 2^96 as a Q64.96 integer.
 */
export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > 887272) {
    throw new Error(`Tick out of range: ${tick}`);
  }

  let ratio =
    (absTick & 0x1) !== 0
      ? 340265354078544963557816517032075149313n
      : 340282366920938463463374607431768211456n;

  if ((absTick & 0x2) !== 0)
    ratio = mulShift(ratio, 340248342086729790484326174814286782778n);
  if ((absTick & 0x4) !== 0)
    ratio = mulShift(ratio, 340214320654664324051920982716015181260n);
  if ((absTick & 0x8) !== 0)
    ratio = mulShift(ratio, 340146287995602323631171512101879684304n);
  if ((absTick & 0x10) !== 0)
    ratio = mulShift(ratio, 340010263488231146823593991679159461444n);
  if ((absTick & 0x20) !== 0)
    ratio = mulShift(ratio, 339738377640345403697157401104375502016n);
  if ((absTick & 0x40) !== 0)
    ratio = mulShift(ratio, 339195258003219555707034227454543997025n);
  if ((absTick & 0x80) !== 0)
    ratio = mulShift(ratio, 338111622100601834656805679988414885971n);
  if ((absTick & 0x100) !== 0)
    ratio = mulShift(ratio, 335954724994790223023589805789778977700n);
  if ((absTick & 0x200) !== 0)
    ratio = mulShift(ratio, 331682121138379247127172139078559817300n);
  if ((absTick & 0x400) !== 0)
    ratio = mulShift(ratio, 323299236684853023288211250268160618739n);
  if ((absTick & 0x800) !== 0)
    ratio = mulShift(ratio, 307163716377032989948697243942600083929n);
  if ((absTick & 0x1000) !== 0)
    ratio = mulShift(ratio, 277268403626896220162999269216087595045n);
  if ((absTick & 0x2000) !== 0)
    ratio = mulShift(ratio, 225923453940442621947126027127485391333n);
  if ((absTick & 0x4000) !== 0)
    ratio = mulShift(ratio, 149997214084966997727330242082538205943n);
  if ((absTick & 0x8000) !== 0)
    ratio = mulShift(ratio, 66119101136024775622716233608466517926n);
  if ((absTick & 0x10000) !== 0)
    ratio = mulShift(ratio, 12847376061809297530290974190478138313n);
  if ((absTick & 0x20000) !== 0)
    ratio = mulShift(ratio, 485053260817066172746253684029974020n);
  if ((absTick & 0x40000) !== 0)
    ratio = mulShift(ratio, 691415978906521570653435304214168n);
  if ((absTick & 0x80000) !== 0)
    ratio = mulShift(ratio, 1404880482679654955896180642n);

  if (tick > 0) {
    ratio =
      115792089237316195423570985008687907853269984665640564039457584007913129639935n /
      ratio;
  }

  // Downcast from Q128.128 to Q64.96 (rounding up).
  let quotient = ratio >> 32n;
  const remainder = ratio & 0xffffffffn;
  if (remainder !== 0n) {
    quotient = quotient + 1n;
  }
  return quotient;
}

/** Returns [price0, price1] where price1 = token1 per token0 (no decimals). */
export function tickToTokenPrices(tick: number): [BigDecimal, BigDecimal] {
  const sqrtPriceX96 = getSqrtRatioAtTick(tick);
  const num = new BigDecimal((sqrtPriceX96 * sqrtPriceX96).toString());
  const price1 = num.div(Q192);

  if (price1.eq(0)) {
    return [ZERO_BD, ZERO_BD];
  }

  const price0 = ONE_BD.div(price1);
  return [price0, price1];
}
