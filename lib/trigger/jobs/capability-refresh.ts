import { logger, schemaTask, schedules } from "@trigger.dev/sdk";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilitatorConnections } from "@/lib/db/schema";
import { testConnection } from "@/lib/facilitators/service";

type RefreshResult = { ok: boolean; latencyMs?: number };

async function refreshConnection(
  projectId: string,
  connectionId: string
): Promise<RefreshResult> {
  try {
    const result = await testConnection({ projectId, connectionId });
    return { ok: true, latencyMs: result.latencyMs };
  } catch {
    return { ok: false };
  }
}

export const capabilityRefreshTask = schemaTask({
  id: "capability-refresh",
  schema: z.object({
    projectId: z.string().uuid(),
    connectionId: z.string().uuid(),
  }),
  run: async (payload) => {
    const result = await refreshConnection(
      payload.projectId,
      payload.connectionId
    );

    if (!result.ok) {
      logger.warn("Capability refresh failed", {
        projectId: payload.projectId,
        connectionId: payload.connectionId,
      });
    }

    return result;
  },
});

export const capabilityRefreshSweepTask = schedules.task({
  id: "capability-refresh-sweep",
  cron: "0 */6 * * *",
  run: async () => {
    const connections = await db
      .select({ id: facilitatorConnections.id, projectId: facilitatorConnections.projectId })
      .from(facilitatorConnections)
      .where(eq(facilitatorConnections.enabled, true));

    let okCount = 0;
    let failCount = 0;

    for (const connection of connections) {
      const result = await refreshConnection(connection.projectId, connection.id);
      if (result.ok) {
        okCount += 1;
      } else {
        failCount += 1;
        logger.warn("Capability refresh failed", {
          projectId: connection.projectId,
          connectionId: connection.id,
        });
      }
    }

    return {
      total: connections.length,
      ok: okCount,
      failed: failCount,
    };
  },
});
