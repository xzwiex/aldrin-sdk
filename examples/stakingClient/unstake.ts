import { wallet } from '../common'
import { AldrinApiPoolsClient, DEFAULT_FARMING_TICKET_END_TIME, StakingClient } from '../../src'
import { log } from '../../src/utils';

async function unstaking(): Promise<string[]> {
  const aldrinPoolsClient = new AldrinApiPoolsClient()
  const stakingClient = new StakingClient()

  const stakingPool = await aldrinPoolsClient.getStakingPoolInfo()

  const result = await stakingClient.endStaking({
    wallet,
    stakingPool,
  })

  log('LOG: Executed successfully.')

  return result
}

unstaking()
