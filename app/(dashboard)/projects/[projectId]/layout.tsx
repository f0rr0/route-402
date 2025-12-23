import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import ProjectNav from "@/components/dashboard/project-nav";
import { Badge } from "@/components/ui/badge";
import { authorize } from "@/lib/rbac/authorize";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const requestHeaders = await headers();
  const authz = await authorize({
    headers: requestHeaders,
    projectId,
    minRole: "viewer",
  });

  const projectRows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const projectName = projectRows[0]?.name ?? "Project";

  const navItems = [
    { href: `/projects/${projectId}`, label: "Overview", exact: true },
    { href: `/projects/${projectId}/facilitators`, label: "Facilitators" },
    { href: `/projects/${projectId}/rules`, label: "Routing rules" },
    { href: `/projects/${projectId}/keys`, label: "API keys" },
    { href: `/projects/${projectId}/logs`, label: "Logs" },
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10 lg:grid lg:min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="dash-fade-up flex flex-col gap-6 border-b border-border/60 bg-white/70 px-6 py-6 backdrop-blur lg:border-b-0 lg:border-r">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
              R402
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Route402</p>
              <p className="text-xs text-muted-foreground">x402 router</p>
            </div>
          </Link>

          <div className="rounded-xl border border-border/60 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Project
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {projectName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted/60 px-2 py-1 font-mono">
                {projectId.slice(0, 8)}...
              </span>
              <Badge variant="default" className="uppercase">
                {authz.orgRole}
              </Badge>
            </div>
          </div>

          <ProjectNav items={navItems} />

          <div className="hidden rounded-xl border border-border/60 bg-white/80 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Facade endpoints
            </p>
            <ul className="mt-3 space-y-2 text-xs font-mono text-muted-foreground">
              <li>POST /api/facilitator/verify</li>
              <li>POST /api/facilitator/settle</li>
              <li>GET /api/facilitator/supported</li>
            </ul>
          </div>
        </aside>

        <main className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="dash-fade-up dash-delay-1 mx-auto flex w-full max-w-6xl flex-col gap-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
