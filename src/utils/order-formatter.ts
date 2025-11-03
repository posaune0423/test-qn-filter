/**
 * Order formatting utilities
 *
 * Converts decoded Drift order parameters to human-readable format
 */

import { BASE_PRECISION, BN, PRICE_PRECISION } from "@drift-labs/sdk";
import { sdkConfig } from "../lib/drift";
import type { DecodedSignedMsgOrder } from "./drift-decoder";

/**
 * Convert hex string or number to BN
 */
function hexToBN(value: string | number): BN {
  // Handle number type
  if (typeof value === "number") {
    return new BN(value);
  }

  // Handle string type
  const hexString = String(value);

  // Remove any leading "0x" if present
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;

  // Handle negative hex (starts with "-")
  if (cleanHex.startsWith("-")) {
    return new BN(cleanHex.slice(1), 16).neg();
  }

  return new BN(cleanHex, 16);
}

/**
 * Format base asset amount (uses BASE_PRECISION = 10^9)
 */
function formatBaseAssetAmount(value: string | number): string {
  const bn = hexToBN(value);
  const numValue = bn.toNumber() / BASE_PRECISION.toNumber();
  return numValue.toFixed(4);
}

/**
 * Format price (uses PRICE_PRECISION = 10^6)
 */
function formatPrice(value: string | number): string {
  const bn = hexToBN(value);
  if (bn.isZero()) {
    return "Market";
  }
  const numValue = bn.toNumber() / PRICE_PRECISION.toNumber();
  return numValue.toFixed(2);
}

/**
 * Resolve perp market symbol by market index
 */
function resolvePerpSymbolByMarketIndex(marketIndex: number): string | undefined {
  const markets = sdkConfig.PERP_MARKETS;
  const found = markets.find((m) => m.marketIndex === marketIndex);
  return found?.symbol;
}

/**
 * Resolve spot market symbol by market index
 */
function resolveSpotSymbolByMarketIndex(marketIndex: number): string | undefined {
  const markets = sdkConfig.SPOT_MARKETS;
  const found = markets.find((m) => m.marketIndex === marketIndex);
  return found?.symbol;
}

/**
 * Get market name from market index using sdkConfig
 */
function getMarketName(marketIndex: number, marketType: "perp" | "spot"): string {
  const symbol =
    marketType === "perp" ? resolvePerpSymbolByMarketIndex(marketIndex) : resolveSpotSymbolByMarketIndex(marketIndex);

  return symbol || `${marketType.toUpperCase()}-${marketIndex}`;
}

/**
 * Get direction string
 */
function getDirection(direction: { long?: unknown; short?: unknown }): string {
  if ("long" in direction) return "Long";
  if ("short" in direction) return "Short";
  return "Unknown";
}

/**
 * Get order type string
 */
function getOrderType(orderType: { market?: unknown; limit?: unknown; oracle?: unknown }): string {
  if ("market" in orderType) return "Market";
  if ("limit" in orderType) return "Limit";
  if ("oracle" in orderType) return "Oracle";
  return "Unknown";
}

/**
 * Format decoded order for display
 */
export interface FormattedOrder {
  tx: string;
  method: string;
  market: string;
  direction: string;
  size: string;
  price: string;
  orderType: string;
}

export function formatDecodedOrder(signature: string, method: string, decoded: DecodedSignedMsgOrder): FormattedOrder {
  const params = decoded.message.signedMsgOrderParams;
  const marketType = "marketType" in params && "perp" in params.marketType ? "perp" : "spot";

  return {
    tx: `https://solscan.io/tx/${signature}`,
    method,
    market: getMarketName(params.marketIndex, marketType),
    direction: getDirection(params.direction),
    size: formatBaseAssetAmount(params.baseAssetAmount),
    price: formatPrice(params.price),
    orderType: getOrderType(params.orderType),
  };
}

/**
 * Display formatted order
 */
export function displayFormattedOrder(order: FormattedOrder): void {
  console.log(`tx: ${order.tx}`);
  console.log(`method: ${order.method}`);
  console.log(`market: ${order.market}`);
  console.log(`direction: ${order.direction}`);
  console.log(`size: ${order.size}`);
  console.log(`price: ${order.price}`);
  console.log(`orderType: ${order.orderType}`);
}
