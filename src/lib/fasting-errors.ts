export class FastConflictError extends Error {
  readonly status = 409;
}
