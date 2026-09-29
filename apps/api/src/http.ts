import type { NextFunction, Request, Response } from "express";
import type { Role } from "@lms/domain";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  memberships: Array<{
    organizationId: string;
    role: Role;
  }>;
};

export type AuthedRequest = Request & {
  user?: CurrentUser;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Unexpected server error" });
}
