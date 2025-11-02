/**
 * Test transaction utilities
 *
 * This module provides utilities for working with test transactions.
 * The actual test transaction data is defined in src/const.ts.
 */

import { TEST_TRANSACTIONS } from "../../src/const";
import type { TestTransaction } from "../../src/types";

/**
 * Check if a test transaction is ready (has real signature)
 */
export function isTestTransactionReady(tx: TestTransaction): boolean {
  return !tx.signature.startsWith("TODO_");
}

/**
 * Get only ready test transactions
 */
export function getReadyTestTransactions(): Record<string, TestTransaction> {
  return Object.fromEntries(Object.entries(TEST_TRANSACTIONS).filter(([_, tx]) => isTestTransactionReady(tx)));
}
