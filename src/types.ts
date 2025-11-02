/**
 * Type definitions for Drift protocol filtering
 */

/**
 * Test transaction definition
 */
export interface TestTransaction {
  signature: string;
  discriminator: string; // RPC format (from actual Solana RPC)
  discriminatorHex?: string;
  quicknodeDiscriminator?: string; // QuickNode Streams format (different from RPC!)
  shouldMatch: boolean;
  description: string;
}
