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

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function decodeBase58(encoded: string): number[] {
  if (typeof encoded !== "string") return [];
  const result = [];
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    if (!char) return [];
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) return []; // Invalid character, return empty array
    for (let j = 0; j < result.length; j++) {
      carry += (result[j] ?? 0) * 58;
      result[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      result.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Add leading zeros
  for (let i = 0; i < encoded.length && encoded[i] === "1"; i++) {
    result.push(0);
  }
  return result.reverse();
}
