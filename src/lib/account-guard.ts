/** Legacy clients may omit the expectation; new clients pin sensitive retries to an account. */
export function matchesExpectedAccount(actual: string, expected?: string | null): boolean {
  return !expected || actual === expected;
}
