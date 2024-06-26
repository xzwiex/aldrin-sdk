import { AUTHORIZED_POOLS, DEFAULT_FARMING_TICKET_END_TIME } from '../../src' // or "@aldrin-exchange/sdk"
import { farmingClient } from '../common'

async function getPoolLiquidityProviders() {
  const allTickets = await farmingClient.getFarmingTickets({
    pool: AUTHORIZED_POOLS.RIN_USDC.poolPublicKey,
  })

  const activeTickets = allTickets.filter((ticket) => !ticket.endTime.eq(DEFAULT_FARMING_TICKET_END_TIME))

  const ticketHolders = new Set(activeTickets.map((ticket) => ticket.userKey.toString()))

  console.log('ticketHolders: ', ticketHolders, ticketHolders.size)
}

getPoolLiquidityProviders()
