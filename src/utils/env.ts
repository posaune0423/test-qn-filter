/**
 * Environment variable utilities
 */

/**
 * Get QuickNode API key from environment variables
 * @throws Error if QUICKNODE_API_KEY is not set
 */
export function getQuickNodeApiKey(): string {
  const apiKey = process.env.QUICKNODE_API_KEY;
  if (!apiKey) {
    throw new Error("QUICKNODE_API_KEY environment variable is required. Please set it in .env file");
  }
  return apiKey;
}

/**
 * Get RPC URL from environment variables
 * Checks QUICKNODE_RPC_URL first, then falls back to RPC_URL
 * @throws Error if neither is set
 */
export function getRpcUrl(): string {
  const rpcUrl = process.env.QUICKNODE_RPC_URL || process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("QUICKNODE_RPC_URL or RPC_URL environment variable is required. Please set it in .env file");
  }
  return rpcUrl;
}

/**
 * Get optional RPC URL from environment variables
 * Returns undefined if neither is set
 */
export function getOptionalRpcUrl(): string | undefined {
  return process.env.QUICKNODE_RPC_URL || process.env.RPC_URL || undefined;
}
