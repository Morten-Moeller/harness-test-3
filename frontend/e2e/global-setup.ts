import { execFileSync } from 'node:child_process'

type SeedResult = {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string; fix?: string }
}

function runMake(...args: string[]): SeedResult {
  const stdout = captureStdout(args)
  const line = stdout.trim().split('\n').at(-1) ?? ''
  return JSON.parse(line) as SeedResult
}

function captureStdout(args: string[]): string {
  try {
    return execFileSync('make', ['-C', '..', '--no-print-directory', ...args], { encoding: 'utf8', timeout: 60_000 })
  } catch (error) {
    const failed = error as { stdout?: string; message: string }
    const stdout = failed.stdout ?? ''
    if (stdout.trim() === '') {
      throw new Error(`make ${args.join(' ')} failed: ${failed.message}`, { cause: error })
    }
    return stdout
  }
}

export default function globalSetup(): void {
  const doctor = runMake('seed-doctor')
  if (!doctor.ok) {
    throw new Error(`environment check failed (${doctor.error?.code}): ${doctor.error?.message}. Fix: ${doctor.error?.fix}`)
  }
  const seed = runMake('seed', 'STATE=empty')
  if (!seed.ok) {
    throw new Error(`test data failed (${seed.error?.code}): ${seed.error?.message}`)
  }
}
