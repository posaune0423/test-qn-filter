/**
 * QuickNode Custom Filter for Drift Perp Trading
 *
 * Monitors Drift protocol perp trading instructions and forwards to webhook.
 * All data parsing/decoding is handled by the webhook endpoint using drift-sdk.
 *
 * Note: This file runs in QuickNode's filter environment and cannot import modules.
 * Constants are defined here to match src/const.ts for consistency.
 * @see src/const.ts for the canonical source of these constants
 */

// These constants match src/const.ts
const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

// Perp instruction discriminators (first 12 chars of base64 data)
// Note: QuickNode Streams uses a different data format than RPC
// These are the actual discriminators from QuickNode Streams, not from RPC
// @see src/const.ts for the canonical source
const PERP_DISCRIMINATORS = [
    'Pe62ShZLxbSn',  // placePerpOrder
    'oktpafA6BG3U',  // placeAndTakePerpOrder
    'qbTdxZcVTFrK',  // placeAndMakePerpOrder
    '2rC4EaE3zM9d',  // placeSignedMsgTakerOrder
    '8tyRUgT5LQ4P',  // placeAndMakeSignedMsgPerpOrder (via JIT CPI, but has different top-level discriminator)
];

function main(stream) {
    try {
        const data = stream.data[0];
        if (!data?.transactions?.length) {
            return null;
        }

        const matchedTransactions = data.transactions
            .filter(matchesFilter)
            .map(tx => formatTransaction(tx, data));

        if (matchedTransactions.length === 0) {
            return null;
        }

        return { matchedTransactions };
    } catch (error) {
        console.error('Filter error:', error);
        return null;
    }
}

function matchesFilter(tx) {
    const instructions = tx.transaction?.message?.instructions;
    if (!instructions) return false;

    return instructions.some(ix =>
        ix.programId === DRIFT_PROGRAM_ID &&
        ix.data?.length >= 12 &&
        PERP_DISCRIMINATORS.includes(ix.data.substring(0, 12))
    );
}

function formatTransaction(tx, data) {
    const instructions = tx.transaction?.message?.instructions || [];

    return {
        signature: tx.transaction?.signatures?.[0],
        slot: data.slot,
        blockTime: data.blockTime,
        success: !tx.meta?.err,
        fee: tx.meta?.fee,
        instructions: instructions
            .filter(ix =>
                ix.programId === DRIFT_PROGRAM_ID &&
                ix.data?.length >= 12 &&
                PERP_DISCRIMINATORS.includes(ix.data.substring(0, 12))
            )
            .map(ix => ({
                programId: ix.programId,
                data: ix.data,
                accounts: ix.accounts
            })),
        logs: tx.meta?.logMessages
    };
}