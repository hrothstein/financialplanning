/**
 * Small error/validation helpers shared by REST routes and MCP tools.
 *
 * Validation failures surface as ApiError with an HTTP status and the
 * documented body shape: { error: { code, message, details } } (PRD §5).
 */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, 'BAD_REQUEST', message, details);
export const notFound = (message, details) => new ApiError(404, 'NOT_FOUND', message, details);

/** Serialize an ApiError (or unknown error) into the documented error body. */
export function toErrorBody(err) {
  if (err instanceof ApiError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }
  return { error: { code: 'INTERNAL', message: 'Internal server error' } };
}

/** Throw badRequest if `value` is not one of `allowed`. Returns the value. */
export function assertEnum(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw badRequest(`Invalid ${field}`, {
      field,
      value,
      allowed,
    });
  }
  return value;
}

/** Throw badRequest unless `value` is a finite number (optionally >= min). */
export function assertNumber(field, value, { min } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`${field} must be a number`, { field, value });
  }
  if (min !== undefined && value < min) {
    throw badRequest(`${field} must be >= ${min}`, { field, value, min });
  }
  return value;
}

/** Throw badRequest unless `value` is a non-empty string. */
export function assertString(field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${field} is required`, { field });
  }
  return value;
}

/** Throw badRequest unless `value` parses as a valid ISO date. */
export function assertDate(field, value) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    throw badRequest(`${field} must be a valid ISO date`, { field, value });
  }
  return value;
}

/**
 * Normalize pagination query params into { limit, offset }.
 * limit defaults to 50, capped at 200; offset defaults to 0.
 */
export function paginate(query = {}) {
  let limit = parseInt(query.limit, 10);
  let offset = parseInt(query.offset, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

/** Apply a limit/offset window to an array, returning a paginated envelope. */
export function paginatedResponse(items, { limit, offset }) {
  return {
    total: items.length,
    limit,
    offset,
    count: Math.min(limit, Math.max(0, items.length - offset)),
    items: items.slice(offset, offset + limit),
  };
}
