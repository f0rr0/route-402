import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgMembers, orgs, projectMembers, projects } from "@/lib/db/schema";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
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
    redirect(`/projects/${projectMembership[0].projectId}`);
  }

  const orgRows = await db
    .select({ id: orgs.id, name: orgs.name })
    .from(orgs)
    .innerJoin(orgMembers, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(orgs.createdAt));

  const orgIds = orgRows.map((org) => org.id);
  if (orgIds.length > 0) {
    const existingProject = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.orgId, orgIds))
      .orderBy(asc(projects.createdAt))
      .limit(1);
    if (existingProject[0]?.id) {
      redirect(`/projects/${existingProject[0].id}`);
    }
  }

  const { orgId: requestedOrgId } = await searchParams;
  const defaultOrgId = orgRows.some((org) => org.id === requestedOrgId)
    ? requestedOrgId
    : orgRows[0]?.id ?? null;

  return (
    <div className="relative min-h-screen bg-slate-50 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center gap-8">
          <div className="space-y-4">
            <Badge className="uppercase">
              Workspace setup
            </Badge>
            <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
              Create your Route402 workspace.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Set up an org and project so you can start connecting facilitators,
              author routing rules, and issue API keys.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/70 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                You will set
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                <li>Organization and project identity</li>
                <li>First routing workspace</li>
                <li>Baseline permissions</li>
              </ul>
            </Card>
            <Card className="border-border/70 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Next steps
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                <li>Add facilitator connections</li>
                <li>Define routing rules</li>
                <li>Create API keys</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="flex items-center">
          <OnboardingForm orgs={orgRows} defaultOrgId={defaultOrgId} />
        </section>
      </div>
    </div>
  );
}
