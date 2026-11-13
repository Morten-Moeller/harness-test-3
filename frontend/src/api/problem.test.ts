import { describe, expect, it } from 'vitest'

import { ApiError, errorCodeOf, parseProblem } from './problem'

const valid = {
  type: 'about:blank',
  title: 'Invalid input',
  status: 400,
  detail: 'title is required',
  instance: '/api/lists',
  errorCode: 'VALIDATION_FAILED',
}

describe('parseProblem', () => {
  const cases: { name: string; body: unknown; want: ReturnType<typeof parseProblem> }[] = [
    { name: 'reads a problem with every field', body: valid, want: { ...valid, errorCode: 'VALIDATION_FAILED' } },
    {
      name: 'reads a problem without detail and instance',
      body: { type: 'about:blank', title: 'Not found', status: 404, errorCode: 'NOT_FOUND' },
      want: { type: 'about:blank', title: 'Not found', status: 404, errorCode: 'NOT_FOUND' },
    },
    {
      name: 'reads a conflict',
      body: { type: 'about:blank', title: 'Conflict', status: 409, errorCode: 'CONFLICT' },
      want: { type: 'about:blank', title: 'Conflict', status: 409, errorCode: 'CONFLICT' },
    },
    { name: 'rejects an unknown errorCode', body: { ...valid, errorCode: 'SOMETHING' }, want: undefined },
    { name: 'rejects a missing errorCode', body: { type: 'a', title: 'b', status: 500 }, want: undefined },
    { name: 'rejects a status that is not a number', body: { ...valid, status: '400' }, want: undefined },
    { name: 'rejects a string body', body: 'Bad Request', want: undefined },
    { name: 'rejects null', body: null, want: undefined },
  ]
  for (const tc of cases) {
    it(tc.name, () => {
      expect(parseProblem(tc.body)).toEqual(tc.want)
    })
  }
})

describe('errorCodeOf', () => {
  it('returns the errorCode of an ApiError with a problem', () => {
    expect(errorCodeOf(new ApiError(parseProblem(valid), 400))).toBe('VALIDATION_FAILED')
  })
  it('returns undefined for an ApiError without a problem', () => {
    expect(errorCodeOf(new ApiError(undefined, 502))).toBeUndefined()
  })
  it('returns undefined for other errors', () => {
    expect(errorCodeOf(new Error('network'))).toBeUndefined()
  })
})
