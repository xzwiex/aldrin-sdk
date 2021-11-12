
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import {
  DEFAULT_FARMING_TICKET_END_TIME,
  END_FARMING_INSTRUCTION_LAYOUT,
  START_FARMING_INSTRUCTION_LAYOUT,
  CLAIM_FARMED_INSTRUCTION_LAYOUT,
  ClaimFarmedInstructionParams,
} from '.';
import { POOLS_PROGRAM_ADDRESS } from '..';
import { account, sighash } from '../utils';
import { EndFarmingInstructionParams, GetFarmingRewardParams, StartFarmingInstructionParams } from './types';
import { getFarmingRewardsFromSnapshots } from './utils';


/**
 * Farming pool transactions and utilites
 */
export class Farming {

  /**
   * Create start farming instruction
   * @param params 
   * @returns 
   */

  static startFarmingInstruction(params: StartFarmingInstructionParams): TransactionInstruction {
    const data = Buffer.alloc(START_FARMING_INSTRUCTION_LAYOUT.span)
    const {
      poolPublicKey,
      farmingState,
      lpTokenFreezeVault,
      userKey,
      tokenAmount,
      lpTokenAccount,
      farmingTicket,
    } = params

    START_FARMING_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('start_farming'),
        tokenAmount,
      },
      data,
    );

    const keys = [
      account(poolPublicKey),
      account(farmingState),
      account(farmingTicket, true),
      account(lpTokenFreezeVault, true),
      account(lpTokenAccount, true),
      account(userKey, false, true),
      account(userKey, false, true),
      account(TOKEN_PROGRAM_ID),
      account(SYSVAR_CLOCK_PUBKEY),
      account(SYSVAR_RENT_PUBKEY),
    ]

    return new TransactionInstruction({
      programId: POOLS_PROGRAM_ADDRESS,
      keys,
      data,
    });
  }


  /**
   * Create end farming instruction
   * @param params 
   * @returns 
   */

  static endFarmingInstruction(params: EndFarmingInstructionParams): TransactionInstruction {
    const data = Buffer.alloc(END_FARMING_INSTRUCTION_LAYOUT.span)
    const {
      poolPublicKey,
      poolSigner,
      farmingState,
      farmingSnapshots,
      farmingTicket,
      lpTokenFreezeVault,
      userPoolTokenAccount,
      userKey,

    } = params

    END_FARMING_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('end_farming'),
      },
      data,
    );

    const keys = [
      account(poolPublicKey),
      account(farmingState),
      account(farmingSnapshots),
      account(farmingTicket, true),
      account(lpTokenFreezeVault, true),
      account(poolSigner),
      account(userPoolTokenAccount, true),
      account(userKey, false, true),
      account(TOKEN_PROGRAM_ID),
      account(SYSVAR_CLOCK_PUBKEY),
      account(SYSVAR_RENT_PUBKEY),
    ]

    return new TransactionInstruction({
      programId: POOLS_PROGRAM_ADDRESS,
      keys,
      data,
    });
  }

  /**
   * Create claimFarmed instruction
   */

  static claimFarmedInstruction(params: ClaimFarmedInstructionParams): TransactionInstruction {
    const data = Buffer.alloc(CLAIM_FARMED_INSTRUCTION_LAYOUT.span)
    const {
      poolPublicKey,
      poolSigner,
      farmingState,
      farmingSnapshots,
      farmingTicket,
      userKey,
      farmingTokenVault,
      userFarmingTokenAccount,
    } = params

    END_FARMING_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('withdraw_farmed'),
      },
      data,
    );

    const keys = [
      account(poolPublicKey),
      account(farmingState),
      account(farmingSnapshots),
      account(farmingTicket, true),
      account(farmingTokenVault, true),
      account(poolSigner),
      account(userFarmingTokenAccount, true),
      account(userKey, false, true),
      account(userKey, true),
      account(TOKEN_PROGRAM_ID),
      account(SYSVAR_CLOCK_PUBKEY),
      account(SYSVAR_RENT_PUBKEY),
    ]

    return new TransactionInstruction({
      programId: POOLS_PROGRAM_ADDRESS,
      keys,
      data,
    });
  }

  /**
   * Calculate Farming Ticket rewards based on farming state & snapshots 
   * @param params 
   * @returns 
   */
  static calculateFarmingRewards(params: GetFarmingRewardParams): BN {
    const { queue, ticket, state } = params

    const ZERO = new BN(0)

    if (DEFAULT_FARMING_TICKET_END_TIME.eq(ticket.endTime)) { // Ticket already claimed
      return ZERO
    }

    const snapshotQueue = queue.find(
      (snapshotQueue) => snapshotQueue.queuePublicKey.equals(state.farmingSnapshots)
    )


    if (!snapshotQueue) {
      return ZERO
    }

    const stateAttached = ticket.statesAttached.find(
      (el) => state.farmingStatePublicKey.equals(el.farmingState)
    )


    // if state attached and last withdraw time more than last farming state snapshot -
    // farming ended
    if (
      stateAttached &&
      stateAttached.lastVestedWithdrawTime >= state.currentTime
    ) {
      return ZERO
    }

    return getFarmingRewardsFromSnapshots({
      ticket,
      state,
      stateAttached,
      snapshots: snapshotQueue.snapshots,
    })
  }

}
