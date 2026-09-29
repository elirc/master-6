import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@lms/domain";
import { hasAnyRole } from "@lms/domain";
import { config } from "../config.js";
import { HttpError, type AuthedRequest, type CurrentUser } from "../http.js";
import { prisma } from "../prisma.js";

type JwtPayload = {
  sub: string;
};

export async function requireAuth(request: AuthedRequest, _response: Response, next: NextFunction) {
  const token = extractBearerToken(request);
  if (!token) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      include: { memberships: true },
      where: { id: payload.sub }
    });

    if (!user) {
      next(new HttpError(401, "User no longer exists"));
      return;
    }

    request.user = {
      email: user.email,
      id: user.id,
      memberships: user.memberships.map((membership) => ({
        organizationId: membership.organizationId,
        role: membership.role as Role
      })),
      name: user.name
    };

    next();
  } catch {
    next(new HttpError(401, "Invalid authentication token"));
  }
}

export function requireOrganizationRole(roles: Role[]) {
  return (request: AuthedRequest, _response: Response, next: NextFunction) => {
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    if (!request.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (!organizationId) {
      next(new HttpError(400, "x-organization-id header is required"));
      return;
    }

    const actor: CurrentUser = request.user;
    const allowed = hasAnyRole(
      {
        id: actor.id,
        memberships: actor.memberships.map((membership) => ({
          organizationId: membership.organizationId,
          role: membership.role,
          userId: actor.id
        }))
      },
      organizationId,
      roles
    );

    if (!allowed) {
      next(new HttpError(403, "Insufficient organization permissions"));
      return;
    }

    next();
  };
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length);
}
