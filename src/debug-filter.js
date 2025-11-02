/**
 * Debug filter to see what data QuickNode actually sends
 */

const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

function main(stream) {
    const logs = [];

    try {
        logs.push('=== DEBUG: Stream data structure ===');
        logs.push('stream.data type: ' + typeof stream.data);
        logs.push('stream.data length: ' + (stream.data?.length || 'undefined'));

        const data = stream.data[0];
        if (!data) {
            return { logs, error: 'No data' };
        }

        logs.push('data.transactions exists: ' + !!data.transactions);
        logs.push('data.transactions length: ' + (data.transactions?.length || 0));

        if (!data?.transactions?.length) {
            return { logs, error: 'No transactions' };
        }

        // Find specific transaction
        const targetSig = 'KiQ1uRDXW6YFG3V8NruXoLDpmmxRgWw44nYBcFTwCeZ53mY9ZKVGGGzJdT61rbiq4En8WpV9BXTi7JDZ3meLLvL';
        let driftTxFound = false;
        logs.push('\nSearching for target transaction: ' + targetSig.substring(0, 20) + '...');

        for (let txIdx = 0; txIdx < data.transactions.length; txIdx++) {
            const tx = data.transactions[txIdx];
            const sig = tx.transaction?.signatures?.[0];

            if (sig === targetSig) {
                driftTxFound = true;
                logs.push(`\n✅ TARGET TRANSACTION FOUND at index ${txIdx}!`);
                logs.push('Signature: ' + sig);

                const instructions = tx.transaction.message.instructions;
                logs.push('Instructions count: ' + instructions.length);

                for (let i = 0; i < instructions.length; i++) {
                    const ix = instructions[i];
                    logs.push(`\nInstruction ${i}:`);
                    logs.push('  programId: ' + (ix.programId || 'undefined'));
                    logs.push('  data type: ' + typeof ix.data);
                    logs.push('  data length: ' + (ix.data?.length || 0));

                    if (ix.data && ix.data.length >= 12) {
                        logs.push('  data (first 12): ' + ix.data.substring(0, 12));
                        logs.push('  data (first 20): ' + ix.data.substring(0, 20));
                    }

                    if (ix.programId === DRIFT_PROGRAM_ID) {
                        logs.push('  ✅ DRIFT INSTRUCTION!');
                        if (ix.data) {
                            logs.push('  Full data: ' + ix.data);
                            logs.push('  Data length (chars): ' + ix.data.length);
                        }
                    }
                }
                break;
            }
        }

        if (!driftTxFound) {
            logs.push(`\n❌ No Drift transaction found in ${data.transactions.length} transactions`);
            logs.push('Checked program IDs in first tx:');
            const firstTx = data.transactions[0];
            if (firstTx?.transaction?.message?.instructions) {
                firstTx.transaction.message.instructions.forEach((ix, i) => {
                    logs.push(`  [${i}] ${ix.programId}`);
                });
            }
        }

        return { logs };
    } catch (error) {
        logs.push('ERROR: ' + error.message);
        return { logs, error: error.message };
    }
}
