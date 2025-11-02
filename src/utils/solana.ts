/**
 * Solana-related utilities
 */

/**
 * Get slot number from transaction signature
 * @param signature - Transaction signature
 * @param rpcUrl - RPC endpoint URL
 * @returns Slot number
 * @throws Error if transaction or slot cannot be retrieved
 */
export async function getSlotFromSignature(signature: string, rpcUrl: string): Promise<number> {
  const { Connection } = await import("@solana/web3.js");
  const connection = new Connection(rpcUrl, "confirmed");
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.slot) {
    throw new Error(`Could not get slot for transaction: ${signature}`);
  }

  return tx.slot;
}

/**
 * Get latest slot number
 * @param rpcUrl - RPC endpoint URL
 * @returns Latest slot number
 */
export async function getLatestSlot(rpcUrl: string): Promise<number> {
  const { Connection } = await import("@solana/web3.js");
  const connection = new Connection(rpcUrl, "confirmed");
  return await connection.getSlot();
}

/**
 * Get latest slots
 * @param rpcUrl - RPC endpoint URL
 * @param count - Number of latest slots to get
 * @returns Array of slot numbers (latest first)
 */
export async function getLatestSlots(rpcUrl: string, count: number): Promise<number[]> {
  const latestSlot = await getLatestSlot(rpcUrl);
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(latestSlot - i);
  }
  return slots;
}
