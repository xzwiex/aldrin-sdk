import {Connection, GetProgramAccountsFilter, Keypair, PublicKey, Transaction} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import BN from 'bn.js';
import {
  ClaimParams,
  STAKING_TICKET_LAYOUT,
} from '.';
import {
  StakingTicket,
  GetStakingTicketsParams,
  SOLANA_RPC_ENDPOINT,
  STAKING_PROGRAM_ADDRESS,
  DEFAULT_FARMING_TICKET_END_TIME,
  createTokenAccountTransaction,
  withdrawFarmedInstruction, AldrinApiPoolsClient,
} from '..';
import { createAccountInstruction, sendTransaction } from '../transactions';
import { Staking } from './staking';
import { StartStakingParams, EndStakingParams, EndStakingTicketParams } from './types';
import { PoolFarmingResponse } from '../api/types';

/**
 * Aldrin Staking client
 */
export class StakingClient {
  constructor(private connection: Connection = new Connection(SOLANA_RPC_ENDPOINT)) {}

  async startStaking(params: StartStakingParams): Promise<string> {
    const { wallet, tokenAmount } = params

    const aldrinPoolsClient = new AldrinApiPoolsClient()

    const stakingPool = await aldrinPoolsClient.getStakingPoolInfo()

    const programId = STAKING_PROGRAM_ADDRESS

    const stakingTicket = Keypair.generate()

    const stakingTicketInstruction = await createAccountInstruction({
      size: STAKING_TICKET_LAYOUT.span,
      connection: this.connection,
      wallet,
      programId,
      newAccountPubkey: stakingTicket.publicKey,
    })

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })

    const tokenAccount = tokenAccounts.value
      .find((item) => item.account.data.parsed.info.mint === stakingPool.poolTokenMint)

    if (!tokenAccount) {
      throw new Error('No account - cannot stake!')
    }

    if (!stakingPool.farming) {
      throw new Error('Dont have any farming tickets - cannot stake!')
    }

    const farmingStateItem = stakingPool.farming.find((item: PoolFarmingResponse) => item.tokensTotal !== item.tokensUnlocked)

    if (!farmingStateItem) {
      throw new Error('Dont have farming item - cannot stake!')
    }

    const stakingTransaction = Staking.stakingInstruction({
      poolPublicKey: new PublicKey(stakingPool.swapToken),
      farmingState: new PublicKey(farmingStateItem.farmingState),
      stakingVault: new PublicKey(stakingPool.stakingVault),
      userStakingTokenAccount: new PublicKey(tokenAccount.pubkey),
      userKey: wallet.publicKey,
      tokenAmount,
      stakingTicket: stakingTicket.publicKey,
      programId,
    })

    const transaction = new Transaction()

    transaction.add(stakingTicketInstruction)
    transaction.add(stakingTransaction)

    return sendTransaction({
      transaction,
      wallet,
      connection: this.connection,
      partialSigners: [stakingTicket],
    })
  }

  async endStaking(params: EndStakingParams): Promise<string[]> {
    const { wallet } = params

    const aldrinPoolsClient = new AldrinApiPoolsClient()
    const stakingPool = await aldrinPoolsClient.getStakingPoolInfo()

    const programId = STAKING_PROGRAM_ADDRESS

    const [poolSigner] = await PublicKey.findProgramAddress(
      [new PublicKey(stakingPool.swapToken).toBuffer()],
      programId
    )

    if (!stakingPool.farming) {
      throw new Error('Dont have any farming tickets - cannot stake!')
    }

    const farmingStateItem = stakingPool.farming.find((item: PoolFarmingResponse) => item.tokensTotal !== item.tokensUnlocked)

    if (!farmingStateItem) {
      throw new Error('Dont have farming item - cannot stake!')
    }

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })

    const tokenAccount = tokenAccounts.value
      .find((item) => item.account.data.parsed.info.mint === stakingPool.poolTokenMint)

    let tokenAccountPublicKey: PublicKey

    if (tokenAccount) {
      tokenAccountPublicKey = tokenAccount.pubkey
    } else {
      const resp = await createTokenAccountTransaction({
        wallet,
        mint: new PublicKey(stakingPool.poolTokenMint),
      })

      tokenAccountPublicKey = resp.newAccountPubkey
    }

    const tickets = await this.getStakingTickets({ userKey: wallet.publicKey })
    const ticketsToClose = tickets
      .filter((ticket) =>
        ticket.endTime.eq(DEFAULT_FARMING_TICKET_END_TIME)
          && ticket.startTime.lt(new BN(Date.now() / 1000).sub(new BN(3600)))
      )

    if (!ticketsToClose.length) {
      throw new Error('No tickets, nothing to check')
    }

    const promises = ticketsToClose.map((ticket) => {
      return this.endStakingTicket({
        wallet,
        poolPublicKey: new PublicKey(stakingPool.swapToken),
        farmingState: new PublicKey(farmingStateItem.farmingState),
        stakingSnapshots: new PublicKey(farmingStateItem.farmingSnapshots),
        stakingVault: new PublicKey(stakingPool.stakingVault),
        userStakingTokenAccount: new PublicKey(tokenAccountPublicKey),
        stakingTicket: ticket.stakingTicketPublicKey,
        poolSigner,
      })
    })

    return Promise.all(promises)
  }

  async endStakingTicket(params: EndStakingTicketParams): Promise<string> {
    const {
      wallet, poolPublicKey, farmingState,
      stakingSnapshots, stakingVault, userStakingTokenAccount,
      stakingTicket, poolSigner,
    } = params

    const transaction = new Transaction()

    transaction.add(
      Staking.unstakingInstruction({
        poolPublicKey,
        farmingState,
        stakingSnapshots,
        stakingVault,
        lpTokenFreezeVault: stakingVault,
        userStakingTokenAccount,
        poolSigner,
        userKey: wallet.publicKey,
        programId: STAKING_PROGRAM_ADDRESS,
        stakingTicket,
      })
    )

    return sendTransaction({
      wallet,
      connection: this.connection,
      transaction,
    })
  }

  async getStakingTickets(params: GetStakingTicketsParams = {}): Promise<StakingTicket[]> {
    const programId = STAKING_PROGRAM_ADDRESS

    const filters: GetProgramAccountsFilter[] = [
      { dataSize: STAKING_TICKET_LAYOUT.span },
    ]

    if (params.userKey) {
      filters.push({
        memcmp: {
          offset: STAKING_TICKET_LAYOUT.offsetOf('userKey') || 0,
          bytes: params.userKey.toBase58(),
        },
      })
    }

    const tickets = await this.connection.getProgramAccounts(programId, {
      filters,
    })

    return tickets.map((t) => {
      const data = STAKING_TICKET_LAYOUT.decode(t.account.data) as StakingTicket
      return {
        ...data,
        stakingTicketPublicKey: t.pubkey,
      }
    })
  }

  async claim(params: ClaimParams): Promise<string> {
    const { stakingPool, wallet } = params

    const programId = STAKING_PROGRAM_ADDRESS

    const [poolSigner] = await PublicKey.findProgramAddress(
        [new PublicKey(stakingPool.swapToken).toBuffer()],
        programId
    )

    if (!stakingPool.farming) {
      throw new Error('Dont have any farming tickets - cannot claim!')
    }

    const farmingStateItem = stakingPool.farming.find((item: PoolFarmingResponse) => item.tokensTotal !== item.tokensUnlocked)

    if (!farmingStateItem) {
      throw new Error('Dont have farming item - cannot claim!')
    }

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })

    const tokenAccount = tokenAccounts.value
        .find((item) => item.account.data.parsed.info.mint === stakingPool.poolTokenMint)

    let tokenAccountPublicKey: PublicKey

    if (tokenAccount) {
      tokenAccountPublicKey = tokenAccount.pubkey
    } else {
      const resp = await createTokenAccountTransaction({
        wallet,
        mint: new PublicKey(stakingPool.poolTokenMint),
      })

      tokenAccountPublicKey = resp.newAccountPubkey
    }

    const farmingCalc = Keypair.generate()

    const transaction = new Transaction()

    transaction.add(
      withdrawFarmedInstruction({
        poolPublicKey: new PublicKey(stakingPool.swapToken),
        farmingState: new PublicKey(farmingStateItem.farmingState),
        farmingTokenVault: new PublicKey(farmingStateItem.farmingTokenVault),
        farmingCalc: farmingCalc.publicKey,
        userFarmingTokenAccount: tokenAccountPublicKey,
        poolSigner,
        userKey: wallet.publicKey,
        programId,
      })
    )

    return sendTransaction({
      wallet,
      connection: this.connection,
      transaction,
    })
  }
}
