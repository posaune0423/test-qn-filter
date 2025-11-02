import { BulkAccountLoader, DriftClient, FastSingleTxSender, initialize, PublicKey, Wallet } from "@drift-labs/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const RPC_URL = process.env.QUICKNODE_RPC_URL || "";
const ENVIRONMENT = "mainnet-beta";

export const sdkConfig = initialize({ env: ENVIRONMENT });

const connection = new Connection(RPC_URL, "confirmed");

const wallet = new Wallet(new Keypair());

export const driftClient = new DriftClient({
  connection,
  wallet,
  programID: new PublicKey(sdkConfig.DRIFT_PROGRAM_ID),
  txParams: {
    computeUnitsPrice: 1000000000,
  },
  // opts: {
  //   skipPreflight: true,
  // },
  txSender: new FastSingleTxSender({
    connection,
    wallet,
    skipConfirmation: true,
    blockhashRefreshInterval: 1000,
  }),
  userStats: true,
  accountSubscription: {
    type: "polling",
    accountLoader: new BulkAccountLoader(connection, "confirmed", 10),
  },
});
