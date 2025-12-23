import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  facilitatorCapabilities,
  facilitatorConnections,
  routingRulesets,
} from "@/lib/db/schema";
import { parseRulesetYaml } from "./dsl";
import type { RoutingContext, RoutingRuleset } from "./types";
import type { SupportedResponse } from "@/lib/facilitators/types";
import type { FacilitatorProvider } from "@/lib/types/credentials";

export type EligibleConnection = {
  id: string;
  name: string;
  provider: FacilitatorProvider;
  credentialsEnc: unknown;
  supportedJson: SupportedResponse | null;
};

export async function loadActiveRuleset(
  projectId: string
): Promise<RoutingRuleset | null> {
  const rows = await db
    .select({
      yamlText: routingRulesets.yamlText,
    })
    .from(routingRulesets)
    .where(
      and(
        eq(routingRulesets.projectId, projectId),
        eq(routingRulesets.enabled, true)
      )
    )
    .orderBy(desc(routingRulesets.version))
    .limit(1);

  if (!rows[0]) {
    return null;
  }

  return parseRulesetYaml(rows[0].yamlText);
}

export async function loadEligibleConnections(
  projectId: string,
  context: RoutingContext
): Promise<EligibleConnection[]> {
  const rows = await db
    .select({
      id: facilitatorConnections.id,
      name: facilitatorConnections.name,
      provider: facilitatorConnections.provider,
      credentialsEnc: facilitatorConnections.credentialsEnc,
      supportedJson: facilitatorCapabilities.supportedJson,
    })
    .from(facilitatorConnections)
    .leftJoin(
      facilitatorCapabilities,
      eq(facilitatorCapabilities.connectionId, facilitatorConnections.id)
    )
    .where(
      and(
        eq(facilitatorConnections.projectId, projectId),
        eq(facilitatorConnections.enabled, true)
      )
    );

  const normalized = rows.map((row) => ({
    ...row,
    supportedJson: row.supportedJson as SupportedResponse | null,
  }));

  return normalized.filter((row) =>
    supportsContext(row.supportedJson, context)
  );
}

function supportsContext(
  supportedJson: SupportedResponse | null,
  context: RoutingContext
): boolean {
  if (!supportedJson || !Array.isArray(supportedJson.schemes)) {
    return false;
  }

  const schemeEntry = supportedJson.schemes.find(
    (entry) => entry.scheme === context.scheme
  );
  if (!schemeEntry) {
    return false;
  }

  if (!context.network) {
    return true;
  }

  if (!Array.isArray(schemeEntry.networks) || schemeEntry.networks.length === 0) {
    return true;
  }

  return schemeEntry.networks.includes(context.network);
}
