"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers, orgs, projectMembers, projects } from "@/lib/db/schema";

const onboardingSchema = z.object({
  orgId: z.string().uuid().optional(),
  orgName: z.string().trim().min(1).max(80).optional(),
  projectName: z.string().trim().min(1).max(80),
});

export type OnboardingResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function createOrgProjectAction(
  input: z.infer<typeof onboardingSchema>
): Promise<OnboardingResult> {
  try {
    const payload = onboardingSchema.parse(input);
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) {
      redirect("/sign-in");
    }

    const userId = session.user.id;
    let orgId = payload.orgId ?? null;

    if (orgId) {
      const membership = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .limit(1);
      if (!membership[0]) {
        return { ok: false, error: "You do not have access to that org." };
      }
      if (membership[0].role === "viewer") {
        return { ok: false, error: "Admin access is required to add projects." };
      }
    } else {
      if (!payload.orgName) {
        return { ok: false, error: "Org name is required." };
      }
      const createdOrg = await db
        .insert(orgs)
        .values({ name: payload.orgName })
        .returning({ id: orgs.id });
      orgId = createdOrg[0]?.id ?? null;
      if (!orgId) {
        return { ok: false, error: "Failed to create org." };
      }
      await db.insert(orgMembers).values({
        orgId,
        userId,
        role: "owner",
      });
    }

    const createdProject = await db
      .insert(projects)
      .values({ orgId, name: payload.projectName })
      .returning({ id: projects.id });

    const projectId = createdProject[0]?.id ?? null;
    if (!projectId) {
      return { ok: false, error: "Failed to create project." };
    }

    await db.insert(projectMembers).values({
      projectId,
      userId,
      role: "owner",
    });

    return { ok: true, projectId };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Failed to create workspace.";
    return { ok: false, error: message };
  }
}
