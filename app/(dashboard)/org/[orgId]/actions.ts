"use server";

import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgMembers, orgs } from "@/lib/db/schema";
import { authorizeOrRedirect, type OrgRole } from "@/lib/rbac/authorize";

const roleSchema = z.enum(["owner", "admin", "viewer"]);

const updateRoleSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  role: roleSchema,
});

const updateOrgSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

export type UpdateMemberRoleResult =
  | { ok: true; role: OrgRole }
  | { ok: false; error: string };

export type UpdateOrgNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export async function updateMemberRoleAction(
  input: z.infer<typeof updateRoleSchema>
): Promise<UpdateMemberRoleResult> {
  try {
    const payload = updateRoleSchema.parse(input);
    const requestHeaders = await headers();
    await authorizeOrRedirect({
      headers: requestHeaders,
      orgId: payload.orgId,
      minRole: "owner",
    });

    const existing = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, payload.orgId),
          eq(orgMembers.userId, payload.userId)
        )
      )
      .limit(1);

    const currentRole = existing[0]?.role;
    if (!currentRole) {
      return { ok: false, error: "Member not found." };
    }

    if (currentRole === payload.role) {
      return { ok: true, role: currentRole };
    }

    if (currentRole === "owner" && payload.role !== "owner") {
      const owners = await db
        .select({ userId: orgMembers.userId })
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, payload.orgId),
            eq(orgMembers.role, "owner")
          )
        );

      if (owners.length <= 1) {
        return {
          ok: false,
          error: "At least one owner is required for each org.",
        };
      }
    }

    await db
      .update(orgMembers)
      .set({ role: payload.role })
      .where(
        and(
          eq(orgMembers.orgId, payload.orgId),
          eq(orgMembers.userId, payload.userId)
        )
      );

    revalidatePath(`/org/${payload.orgId}`);
    return { ok: true, role: payload.role };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Failed to update member.";
    return { ok: false, error: message };
  }
}

export async function updateOrgNameAction(
  input: z.infer<typeof updateOrgSchema>
): Promise<UpdateOrgNameResult> {
  try {
    const payload = updateOrgSchema.parse(input);
    const requestHeaders = await headers();
    await authorizeOrRedirect({
      headers: requestHeaders,
      orgId: payload.orgId,
      minRole: "owner",
    });

    const updated = await db
      .update(orgs)
      .set({ name: payload.name })
      .where(eq(orgs.id, payload.orgId))
      .returning({ name: orgs.name });

    const name = updated[0]?.name;
    if (!name) {
      return { ok: false, error: "Org not found." };
    }

    revalidatePath(`/org/${payload.orgId}`);
    return { ok: true, name };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Failed to update org name.";
    return { ok: false, error: message };
  }
}
