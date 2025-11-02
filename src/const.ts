/**
 * Constants for Drift protocol filtering
 */

import type { TestTransaction } from "./types";

/**
 * Drift Protocol program ID on Solana
 */
export const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

/**
 * QuickNode network identifier
 */
export const QUICKNODE_NETWORK = "solana-mainnet" as const;

/**
 * Perp instruction discriminators (first 12 chars of base64 data)
 * Note: QuickNode Streams uses a different data format than RPC
 * These are the actual discriminators from QuickNode Streams, not from RPC
 */
export const PERP_DISCRIMINATORS = [
  "Pe62ShZLxbSn", // placePerpOrder
  "oktpafA6BG3U", // placeAndTakePerpOrder
  "qbTdxZcVTFrK", // placeAndMakePerpOrder
  "2rC4EaE3zM9d", // placeSignedMsgTakerOrder
  "8tyRUgT5LQ4P", // placeAndMakeSignedMsgPerpOrder (via JIT CPI, but has different top-level discriminator)
] as const;

/**
 * Test transactions for each Drift perp instruction type
 *
 * These transactions are used to verify discriminators and test the filter.
 * Each transaction represents a specific Drift perp instruction type.
 *
 * To add a new test transaction:
 * 1. Find a real transaction on Solscan (https://solscan.io/)
 * 2. Verify the discriminator using: bun scripts/tools/verify-discriminators.ts <signature> <instructionName>
 * 3. Add the transaction details below
 */
export const TEST_TRANSACTIONS = {
  /**
   * placeSpotOrder - Spot market order placement
   * This is for spot orders only, should NOT match perp filter
   */
  placeSpotOrder: {
    signature: "3eZ7u4p5qA6e8q6r6PpLkpPZccD51wvfyHZ43TanpecohVMAkfStsN5HqTK8NLCf2PzBjRACTqJL6fM99PNNeuzJ",
    discriminator: "PD8yewzFPL4=", // RPC format
    discriminatorHex: "0x3c3f327b0cc53cbe",
    quicknodeDiscriminator: "FTmTo4nDV5RV", // QuickNode format
    shouldMatch: false,
    description: "Spot order placement (not perp)",
  },

  /**
   * placePerpOrder - Standard perp order placement
   * Most common method for placing orders on the orderbook
   */
  placePerpOrder: {
    signature: "KiQ1uRDXW6YFG3V8NruXoLDpmmxRgWw44nYBcFTwCeZ53mY9ZKVGGGzJdT61rbiq4En8WpV9BXTi7JDZ3meLLvL",
    discriminator: "RaFdynh+TLk=", // RPC format
    discriminatorHex: "0x45a15dca787e4cb9",
    quicknodeDiscriminator: "Pe62ShZLxbSn", // QuickNode format
    shouldMatch: true,
    description: "Standard perp order placement",
  },

  /**
   * placeAndTakePerpOrder - Taker order
   * Places an order and attempts to match with existing maker orders
   */
  placeAndTakePerpOrder: {
    signature: "5tGQLySmvNnQ7ZfzKUZc6qWcB4CBj1SYFT1gd2Lb1wCGVHG4bmPw9bkLvHhc6KDYTQgzaWBd7LroYcdTfz37Njky",
    discriminator: "1TMBu2zc5uA=", // RPC format
    discriminatorHex: "0xd53301bb6cdce6e0",
    quicknodeDiscriminator: "oktpafA6BG3U", // QuickNode format
    shouldMatch: true,
    description: "Place and take perp order (taker side)",
  },

  /**
   * placeAndMakePerpOrder - Maker order
   * Places an order as a maker against a specific taker order
   */
  placeAndMakePerpOrder: {
    signature: "PYjgxKZB5UrU4sJqMmDj6mkgc1qw4K6cmi1y9EynxcQSE3M3B1svPhn1Dz2EfWhKvxv2Sqcz5BYnC4dYHscrAF1",
    discriminator: "lXUL7S9fWe0=", // RPC format
    discriminatorHex: "0x95750bed2f5f59ed",
    quicknodeDiscriminator: "qbTdxZcVTFrK", // QuickNode format
    shouldMatch: true,
    description: "Place and make perp order (maker side)",
  },

  /**
   * placeOrders - Batch order placement (up to 32 orders)
   * Places multiple orders in a single transaction
   * Supports BOTH perp and spot orders based on each order's market_type
   * Note: Since it's not perp-exclusive, we exclude it from the perp filter
   */
  placeOrders: {
    signature: "wYF3PkQxeJNQu1je5aHpB8ykJeij4bsfhhhPobgQkyuogrNvCwTrFFgaASKDzhCDVTYediTcZDxHrCNa94Rvg7B",
    discriminator: "PD8yewzFPL4=", // RPC format
    discriminatorHex: "0x3c3f327b0cc53cbe",
    quicknodeDiscriminator: "FTmTo4nDV5RV", // QuickNode format (same as placeSpotOrder)
    shouldMatch: false,
    description: "Batch order placement (perp/spot mixed, not perp-exclusive)",
  },

  /**
   * placeSignedMsgTakerOrder - Pre-signed taker order
   * Allows third-party submission of pre-signed orders
   * Used for JIT liquidity, copy trading, gasless transactions
   */
  placeSignedMsgTakerOrder: {
    signature: "2XZEL1VY8d8ZRgLsjMNAMLDGPt5oPBy1nz9ho2ZZXcLWwmjrscNhRjipX45WiEh7NGKKktabfoCq5dWGGn2DwYvS",
    discriminator: "IE9lixkGYg8=", // RPC format
    discriminatorHex: "0x204f658b1906620f",
    quicknodeDiscriminator: "2rC4EaE3zM9d", // QuickNode format
    shouldMatch: true,
    description: "Place signed message taker order",
  },

  /**
   * placeAndMakeSignedMsgPerpOrder - Maker order for signed message
   * Provides liquidity to a signed message taker order
   * Note: This transaction's structure:
   *   - Top-level: placeSignedMsgTakerOrder (IE9lixkGYg8=)
   *   - CPI via JIT program: placeAndMakeSignedMsgPerpOrder (YkdBVlJIdnc=)
   * QuickNode Streams only sees the top-level instruction discriminator
   */
  placeAndMakeSignedMsgPerpOrder: {
    signature: "2EfEUs1ieBCWxBXnTakkH9cdTH6DbBzyTJte9uxjuGmZJ2Teza2jwBH7T4EgtNXUQyPRnDYfZSgyj8nXTjtoex28",
    discriminator: "IE9lixkGYg8=", // RPC format (top-level instruction)
    discriminatorHex: "0x204f658b1906620f",
    quicknodeDiscriminator: "8tyRUgT5LQ4P", // QuickNode format
    shouldMatch: true,
    description: "Place and make signed message perp order (via JIT CPI)",
  },
} as const satisfies Record<string, TestTransaction>;
