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

const checkNamesAsList = async(inputCheckName: string): Promise<string[]> => {
  if(!inputCheckName)
    return []

  if(!inputCheckName.includes(','))
    return [inputCheckName]

  return inputCheckName.split(",")
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
  let checkList = await checkNamesAsList(checkNames)

  console.log('checkList: '+checkList)

  let checkMap = new Map()
  checkList.forEach((name: string) => {
    checkMap.set(name, 'pending')
  });

  while (now <= deadline) {
    for (let [key, value] of checkMap.entries()) {
      console.log(
        `Calling listForRef check runs named ${key} on ${owner}/${repo}@${ref}...`
      )
      const result = await client.rest.checks.listForRef({
        check_name: key,
        owner,
        repo,
        ref
      })

      console.log(
        `Retrieved check_runs length of ${result.data.check_runs.length} check runs named ${key}`
      )

      const completedCheck = result.data.check_runs.find(
        checkRun => checkRun.status === 'completed'
      )
      if (completedCheck) {
        console.log(
          `Found a completed check with id ${completedCheck.id} and conclusion ${completedCheck.conclusion} for ${key}`
        )
        // conclusion is only `null` if status is not `completed`.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        checkMap.set(key,completedCheck.conclusion!)
      }
      else {
        console.log(
          `Still pending for ${key}`
        )
      }
    }

    let pending_count = 0
    for await (let [key, value] of checkMap.entries()){
      console.log(`Conclusion set to ${value} for ${key}`)
      if(value === 'pending'){
        pending_count++
        //break;
      }
    }

    if(!pending_count)
      break;

    console.log(
      `Some more checks pending, waiting for ${intervalSeconds} seconds...`
    )

    await wait(intervalSeconds * 1000)
    now = new Date().getTime()
  }

  for await (let [_, value] of checkMap.entries()){
    if(value === 'failure') return 'failure';
  }

  for await (let [_, value] of checkMap.entries()){
    if(value === 'pending'){
      console.log(
        `Checks are still pending after ${timeoutSeconds} seconds, exiting with conclusion 'timed_out'`
      )
      return 'timed_out'
    }
  }

  return 'success'

}
