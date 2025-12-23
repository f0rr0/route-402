import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { authorize } from "@/lib/rbac/authorize";
import { db } from "@/lib/db";
import { routingRulesets } from "@/lib/db/schema";
import RulesEditor from "./rules-editor";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const requestHeaders = await headers();
  await authorize({
    headers: requestHeaders,
    projectId,
    minRole: "viewer",
  });

  const latest = await db
    .select({
      yamlText: routingRulesets.yamlText,
      version: routingRulesets.version,
    })
    .from(routingRulesets)
    .where(eq(routingRulesets.projectId, projectId))
    .orderBy(desc(routingRulesets.version))
    .limit(1);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Project
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Routing rules</h1>
        <p className="text-sm text-muted-foreground">
          Validate YAML rules and run dry tests before saving a new version.
        </p>
      </header>

      <RulesEditor
        projectId={projectId}
        initialYaml={latest[0]?.yamlText}
        initialVersion={latest[0]?.version ?? null}
      />
    </div>
  );
}
