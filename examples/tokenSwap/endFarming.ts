import { PublicKey } from '@solana/web3.js';
import { TokenSwap } from '../../src'; // or "@aldrin-exchange/sdk"
import { wallet } from '../common';


/** Claim all available to claim tickets */

export async function startFarming() {
  const tokenSwap = await TokenSwap.initialize()

  const txId = await tokenSwap.endFarming({
    wallet,
    // poolMint: AUTHORIZED_POOLS.SOL_USDC.poolMint,
    poolMint: new PublicKey('J5mbqcCa2L6JSZHjr29PABgPsPFKgB6XYw7kbi1cR19x'),
  })
  console.log(`Farming finished: ${txId}`)
}

startFarming()