/**
 * QuickNode Webhook API Client
 *
 * This module provides functions to interact with QuickNode's Webhook REST API.
 * @see https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-test-filter
 */

export interface TestFilterRequest {
  network: string;
  block: string;
  filter_function: string; // base64 encoded filter function
}

export interface FilteredTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  instructions: Array<{
    instructionName: string;
    category: string;
    discriminator: string;
    authority: string | null;
    userAccount: string | null;
    state: string | null;
    mayContainTakeProfitStopLoss: boolean;
    argsLength?: number;
    argsHex?: string;
  }>;
  fee?: number;
  success: boolean;
  error?: unknown;
  logs?: string[];
}

export interface FilteredBlock {
  block: {
    slot: number;
    blockTime: number;
    blockHeight?: number;
  };
  transactions: FilteredTransaction[];
}

export interface TestFilterResponse {
  filtered_data?: FilteredBlock[] | null;
  result?: FilteredBlock[] | null;
  logs?: string[];
  block?: string;
  network?: string;
}

export interface QuickNodeClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class QuickNodeClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: QuickNodeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || "https://api.quicknode.com/webhooks/rest/v1";
  }

  /**
   * Test a filter function against a specific block
   *
   * @param network - Network identifier (e.g., "solana-mainnet", "ethereum-mainnet")
   * @param block - Block number or slot to test against
   * @param filterFunction - The filter function code (will be base64 encoded)
   * @returns Promise resolving to the filtered data
   */
  async testFilter(network: string, block: string, filterFunction: string): Promise<TestFilterResponse> {
    const url = `${this.baseUrl}/webhooks/test_filter`;

    // Encode filter function to base64
    const filterFunctionBase64 = Buffer.from(filterFunction).toString("base64");

    const payload: TestFilterRequest = {
      network,
      block,
      filter_function: filterFunctionBase64,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(`QuickNode API error: ${JSON.stringify(errorData)}`);
    }

    return (await response.json()) as TestFilterResponse;
  }
}
