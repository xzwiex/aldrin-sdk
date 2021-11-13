
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import { DepositLiquididtyInstructionParams, DEPOSIT_LIQUIDITY_INSTRUCTION_LAYOUT, Side, SWAP_INSTRUCTION_LAYOUT, WithdrawLiquidityInstructionParams, WITHDRAW_LIQUIDITY_INSTRUCTION_LAYOUT } from '.';
import { POOLS_PROGRAM_ADDRESS } from '..';
import { account, sighash } from '../utils';
import { SIDE, SwapInstructionParams } from './types/swap';


/**
 * Pool instructions & help utils
 */

export class Pool {
  
  /**
     * Create deposit liquidity instruction
     * @param params 
     * @returns 
     */
  static depositLiquididtyInstruction(params: DepositLiquididtyInstructionParams) {

    const data = Buffer.alloc(DEPOSIT_LIQUIDITY_INSTRUCTION_LAYOUT.span)
    const { creationSize, maxBaseTokenAmount, maxQuoteTokenAmount } = params

    DEPOSIT_LIQUIDITY_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('create_basket'),
        creationSize,
        maxBaseTokenAmount,
        maxQuoteTokenAmount,
      },
      data,
    );

    const keys = [
      account(params.pool.poolPublicKey),
      account(params.pool.poolMint, true),
      account(params.poolSigner),
      account(params.userBaseTokenAccount, true),
      account(params.userQuoteTokenAccount, true),
      account(params.pool.baseTokenVault, true),
      account(params.pool.quoteTokenVault, true),
      account(params.userPoolTokenAccount, true),
      account(params.walletAuthority, false, true),
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
   * Create widthradw liquidity instruction
   * @param params 
   * @returns 
   */

  static withdrawLiquidityInstruction(params: WithdrawLiquidityInstructionParams): TransactionInstruction {

    const data = Buffer.alloc(WITHDRAW_LIQUIDITY_INSTRUCTION_LAYOUT.span)
    const {
      poolTokenAmount,
      baseTokenReturnedMin,
      quoteTokenReturnedMin,
      poolSigner,
      userPoolTokenAccount,
      userBaseTokenAccount,
      userQuoteTokenAccount,
      walletAuthority,
      pool: {
        feeBaseAccount,
        feeQuoteAccount,
        poolPublicKey,
        poolMint,
        baseTokenVault,
        quoteTokenVault,
      },
    } = params

    WITHDRAW_LIQUIDITY_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('redeem_basket'),
        redemptionSize: poolTokenAmount,
        baseTokenReturnedMin,
        quoteTokenReturnedMin,
      },
      data,
    );

    const keys = [
      account(poolPublicKey),
      account(poolMint, true),
      account(baseTokenVault, true),
      account(quoteTokenVault, true),
      account(poolSigner),
      account(userPoolTokenAccount, true),
      account(userBaseTokenAccount, true),
      account(userQuoteTokenAccount, true),
      account(walletAuthority, false, true),
      account(walletAuthority),
      account(TOKEN_PROGRAM_ID),
      account(feeBaseAccount, true),
      account(feeQuoteAccount, true),
      account(SYSVAR_CLOCK_PUBKEY),
    ]

    return new TransactionInstruction({
      programId: POOLS_PROGRAM_ADDRESS,
      keys,
      data,
    });
  }

  /**
   * Create swap tokens instruction
   * @param params 
   * @returns
   */

  static swapInstruction(params: SwapInstructionParams): TransactionInstruction {

    const data = Buffer.alloc(SWAP_INSTRUCTION_LAYOUT.span)
    const {
      outcomeAmount,
      minIncomeAmount,
      side,
      pool: {
        poolPublicKey,
        poolMint,
        baseTokenVault,
        quoteTokenVault,
        feePoolTokenAccount,
      },
      walletAuthority,
      poolSigner,
      userBaseTokenAccount,
      userQuoteTokenAccount,
    } = params

    SWAP_INSTRUCTION_LAYOUT.encode(
      {
        instruction: sighash('swap'),
        tokens: outcomeAmount,
        minTokens: minIncomeAmount,
        side: side === SIDE.ASK ? Side.Ask : Side.Bid,
      },
      data,
    );

    const keys = [
      account(poolPublicKey),
      account(poolSigner),
      account(poolMint, true),
      account(baseTokenVault, true),
      account(quoteTokenVault, true),
      account(feePoolTokenAccount, true),
      account(walletAuthority, false, true),
      account(userBaseTokenAccount, true),
      account(userQuoteTokenAccount, true),
      account(TOKEN_PROGRAM_ID),
    ]

    return new TransactionInstruction({
      programId: POOLS_PROGRAM_ADDRESS,
      keys,
      data,
    });
  }

}