import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers, projectMembers, projects } from "@/lib/db/schema";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./errors";

export type OrgRole = "owner" | "admin" | "viewer";

export type AuthzContext = {
  orgId: string;
  projectId?: string;
  orgRole: OrgRole;
  userId: string;
};

export type AuthorizeOptions = {
  headers: Headers;
  orgId?: string;
  projectId?: string;
  minRole?: OrgRole;
};

const roleRank: Record<OrgRole, number> = {
  viewer: 0,
  admin: 1,
  owner: 2,
};

function hasSufficientRole(role: OrgRole, minRole?: OrgRole) {
  if (!minRole) {
    return true;
  }
  return roleRank[role] >= roleRank[minRole];
}

export async function authorize(options: AuthorizeOptions): Promise<AuthzContext> {
  const session = await auth.api.getSession({ headers: options.headers });
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  let orgId = options.orgId;
  const projectId = options.projectId;

  if (!orgId && !projectId) {
    throw new BadRequestError("orgId or projectId is required");
  }

  if (!orgId && projectId) {
    const rows = await db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundError("Project not found");
    }
    orgId = rows[0].orgId;
  }

  let role: OrgRole | null = null;

  if (projectId) {
    const rows = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);
    role = rows[0]?.role ?? null;
  }

  if (!role && orgId) {
    const rows = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1);
    role = rows[0]?.role ?? null;
  }

  if (!role) {
    throw new ForbiddenError("Membership not found");
  }

  if (!hasSufficientRole(role, options.minRole)) {
    throw new ForbiddenError("Insufficient permissions");
  }

  if (!orgId) {
    throw new BadRequestError("orgId could not be resolved");
  }

  return {
    orgId,
    projectId,
    orgRole: role,
    userId,
  };
}

export async function authorizeOrRedirect(
  options: AuthorizeOptions
): Promise<AuthzContext> {
  try {
    return await authorize(options);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/sign-in");
    }
    throw error;
  }
}
