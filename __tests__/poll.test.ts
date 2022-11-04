import {poll} from '../src/poll'

const client = {
  rest: {
    checks: {
      listForRef: jest.fn()
    }
  }
}

const run = () =>
  poll({
    client: client as any,
    log: () => {},
    checkNames: 'test,test1',
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    timeoutSeconds: 6,
    intervalSeconds: 1
  })

test('returns conclusion of completed check', async () => {
  client.rest.checks.listForRef.mockResolvedValue({
    data: {
      check_runs: [
        {
          id: '1',
          status: 'pending'
        },
        {
          id: '2',
          status: 'completed',
          conclusion: 'success'
        }
      ]
    }
  })

  const result = await run()

  expect(result).toBe('success')
  expect(client.rest.checks.listForRef).toHaveBeenCalledWith({
    owner: 'testOrg',
    repo: 'testRepo',
    ref: 'abcd',
    check_name: 'test'
  })
})

test('polls until check is completed', async () => {
  client.rest.checks.listForRef
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'pending'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'pending'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '1',
            status: 'completed',
            conclusion: 'failure'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '2',
            status: 'pending'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '2',
            status: 'pending'
          }
        ]
      }
    })
    .mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            id: '2',
            status: 'completed',
            conclusion: 'failure'
          }
        ]
      }
    })

  const result = await run()

  expect(result).toBe('failure')
  expect(client.rest.checks.listForRef).toHaveBeenCalledTimes(6)
})

test(`returns 'timed_out' if exceeding deadline`, async () => {
  client.rest.checks.listForRef
  .mockResolvedValue({
    data: {
      check_runs: [
        {
          id: '1',
          status: 'pending'
        }
      ]
    }
  })

  const result = await run()
  expect(result).toBe('timed_out')
})
