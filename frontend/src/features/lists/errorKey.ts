import { errorCodeOf } from '../../api/problem'

export type ErrorKey = 'errors.validationFailed' | 'errors.notFound' | 'errors.unknown'

export function errorKey(error: unknown): ErrorKey {
  switch (errorCodeOf(error)) {
    case 'VALIDATION_FAILED':
      return 'errors.validationFailed'
    case 'NOT_FOUND':
      return 'errors.notFound'
    default:
      return 'errors.unknown'
  }
}
