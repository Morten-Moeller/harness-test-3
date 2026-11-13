export const errorCodes = ['VALIDATION_FAILED', 'NOT_FOUND', 'INTERNAL'] as const

export type ErrorCode = (typeof errorCodes)[number]

export type Problem = {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  errorCode: ErrorCode
}

export function parseProblem(body: unknown): Problem | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }
  const record = body as Record<string, unknown>
  const { type, title, status, errorCode, detail, instance } = record
  if (typeof type !== 'string' || typeof title !== 'string' || typeof status !== 'number') {
    return undefined
  }
  if (typeof errorCode !== 'string' || !errorCodes.includes(errorCode as ErrorCode)) {
    return undefined
  }
  return {
    type,
    title,
    status,
    errorCode: errorCode as ErrorCode,
    ...(typeof detail === 'string' ? { detail } : {}),
    ...(typeof instance === 'string' ? { instance } : {}),
  }
}

export class ApiError extends Error {
  readonly problem: Problem | undefined

  constructor(problem: Problem | undefined, status: number) {
    super(problem?.title ?? `request failed with status ${status}`)
    this.name = 'ApiError'
    this.problem = problem
  }
}

export function errorCodeOf(error: unknown): ErrorCode | undefined {
  return error instanceof ApiError ? error.problem?.errorCode : undefined
}
