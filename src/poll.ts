import {GitHub} from '@actions/github/lib/utils'
import {wait} from './wait'

export interface Options {
  client: InstanceType<typeof GitHub>
  log: (message: string) => void

  checkNames: string
  timeoutSeconds: number
  intervalSeconds: number
  owner: string
  repo: string
  ref: string
}

const checkNamesAsList = async (inputCheckName: string): Promise<string[]> => {
  if (!inputCheckName) return []

  if (!inputCheckName.includes(',')) return [inputCheckName]

  return inputCheckName.split(',')
}

export const poll = async (options: Options): Promise<string> => {
  const {
    client,
    log,
    checkNames,
    timeoutSeconds,
    intervalSeconds,
    owner,
    repo,
    ref
  } = options

  let now = new Date().getTime()
  const deadline = now + timeoutSeconds * 1000
  const checkList = await checkNamesAsList(checkNames)

  log(`Processing checkList: ${checkList}`)

  const checkMap = new Map()
  for (const name of checkList) {
    checkMap.set(name, 'pending')
  }
  //  checkList.forEach((name: string) => {
  //    checkMap.set(name, 'pending')
  //  })

  while (now <= deadline) {
    for (const [key] of checkMap.entries()) {
      log(
        `Calling listForRef check runs named ${key} on ${owner}/${repo}@${ref}...`
      )
      const result = await client.rest.checks.listForRef({
        check_name: key,
        owner,
        repo,
        ref
      })

      log(
        `Retrieved check_runs length of ${result.data.check_runs.length} check runs named ${key}`
      )

      const completedCheck = result.data.check_runs.find(
        checkRun => checkRun.status === 'completed'
      )
      if (completedCheck) {
        log(
          `Found a completed check with id ${completedCheck.id} and conclusion ${completedCheck.conclusion} for ${key}`
        )
        // conclusion is only `null` if status is not `completed`.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        checkMap.set(key, completedCheck.conclusion!)
      } else {
        log(`Still pending for ${key}`)
      }
    }

    let pending_count = 0
    for await (const [key, value] of checkMap.entries()) {
      log(`Conclusion set to ${value} for ${key}`)
      if (value === 'pending') {
        pending_count++
        //break;
      }
    }

    if (!pending_count) break

    log(`Some more checks pending, waiting for ${intervalSeconds} seconds...`)

    await wait(intervalSeconds * 1000)
    now = new Date().getTime()
  }

  for await (const [, value] of checkMap.entries()) {
    if (value === 'failure') return 'failure'
  }

  for await (const [, value] of checkMap.entries()) {
    if (value === 'pending') {
      log(
        `Checks are still pending after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`
      )
      return 'timed_out'
    }
  }

  return 'success'
}
