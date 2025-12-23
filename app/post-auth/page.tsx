import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers, projectMembers, projects } from "@/lib/db/schema";

export default async function PostAuthPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const userId = session.user.id;

  const projectMembership = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .orderBy(asc(projectMembers.createdAt))
    .limit(1);

  if (projectMembership[0]?.projectId) {
    redirect(`/projects/${projectMembership[0].projectId}/facilitators`);
  }

  const orgMembership = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(orgMembers.createdAt))
    .limit(1);

  if (orgMembership[0]?.orgId) {
    const project = await db
      .select({ projectId: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgMembership[0].orgId))
      .orderBy(asc(projects.createdAt))
      .limit(1);

    if (project[0]?.projectId) {
      redirect(`/projects/${project[0].projectId}/facilitators`);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">
        No project access yet
      </h1>
      <p className="text-sm text-zinc-600">
        Ask an org owner to add you to a project, then sign in again.
      </p>
      <Link href="/" className="text-sm font-semibold text-zinc-900 underline">
        Back to home
      </Link>
    </div>
  );
}
