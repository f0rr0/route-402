export type AuthzErrorCode = "unauthorized" | "forbidden" | "not_found" | "bad_request";

export class AuthzError extends Error {
  readonly status: number;
  readonly code: AuthzErrorCode;

  constructor(code: AuthzErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class UnauthorizedError extends AuthzError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends AuthzError {
  constructor(message = "Insufficient permissions") {
    super("forbidden", message, 403);
  }
}

export class NotFoundError extends AuthzError {
  constructor(message = "Resource not found") {
    super("not_found", message, 404);
  }
}

export class BadRequestError extends AuthzError {
  constructor(message = "Invalid request") {
    super("bad_request", message, 400);
  }
}
