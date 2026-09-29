import type { Actor, Membership, Role } from "./types.js";

const roleRank: Record<Role, number> = {
  LEARNER: 1,
  INSTRUCTOR: 2,
  ORG_ADMIN: 3,
  ADMIN: 4
};

export function hasRoleAtLeast(actor: Actor, organizationId: string, minimumRole: Role): boolean {
  return actor.memberships.some((membership) => {
    return membership.organizationId === organizationId && roleRank[membership.role] >= roleRank[minimumRole];
  });
}

export function hasAnyRole(actor: Actor, organizationId: string, roles: Role[]): boolean {
  return actor.memberships.some((membership) => {
    return membership.organizationId === organizationId && roles.includes(membership.role);
  });
}

export function canManageCourse(actor: Actor, courseOrganizationId: string): boolean {
  return hasAnyRole(actor, courseOrganizationId, ["INSTRUCTOR", "ORG_ADMIN", "ADMIN"]);
}

export function canViewLearnerRecord(actor: Actor, learnerMembership: Membership): boolean {
  if (actor.id === learnerMembership.userId) {
    return true;
  }

  return hasRoleAtLeast(actor, learnerMembership.organizationId, "INSTRUCTOR");
}

export function canImpersonate(actor: Actor, organizationId: string): boolean {
  return hasAnyRole(actor, organizationId, ["ORG_ADMIN", "ADMIN"]) && !actor.impersonatingUserId;
}

export function assertAuthorized(condition: boolean, message = "You are not authorized to perform this action"): void {
  if (!condition) {
    throw new Error(message);
  }
}
