import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { routingRulesets } from "@/lib/db/schema";
import RulesEditor from "./rules-editor";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
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
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
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
