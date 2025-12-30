import Link from "next/link";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authorizeOrRedirect } from "@/lib/rbac/authorize";
import { db } from "@/lib/db";
import { orgMembers, orgs, projects, users } from "@/lib/db/schema";
import OrgSettingsClient, { type OrgMemberListItem } from "./org-settings-client";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const requestHeaders = await headers();
  const authz = await authorizeOrRedirect({
    headers: requestHeaders,
    orgId,
    minRole: "viewer",
  });

  const orgRows = await db
    .select({ name: orgs.name, createdAt: orgs.createdAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  const org = orgRows[0];
  const orgName = org?.name ?? "Organization";
  const orgCreatedAt = org?.createdAt ?? new Date();

  const members = await db
    .select({
      userId: orgMembers.userId,
      role: orgMembers.role,
      joinedAt: orgMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(asc(orgMembers.createdAt));

  const memberRows: OrgMemberListItem[] = members.map((member) => ({
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    name: member.name,
    email: member.email,
    isCurrentUser: member.userId === authz.userId,
  }));

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(asc(projects.createdAt))
    .limit(1);

  const primaryProject = projectRows[0];

  return (
    <div className="relative min-h-screen bg-slate-50 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Organization settings
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {orgName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage org profile, members, and roles.
            </p>
          </div>
          {primaryProject ? (
            <Link
              href={`/projects/${primaryProject.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Back to {primaryProject.name}
            </Link>
          ) : null}
        </header>

        <OrgSettingsClient
          orgId={orgId}
          orgName={orgName}
          orgCreatedAt={orgCreatedAt.toISOString()}
          canManage={authz.orgRole === "owner"}
          members={memberRows}
        />
      </div>
    </div>
  );
}
