import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilitatorConnections, settlementState } from "@/lib/db/schema";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { decryptProjectPayload } from "@/lib/crypto/project-payload";
import type { EncryptedPayload } from "@/lib/crypto";
import { getAdapter } from "@/lib/facilitators";
import type { SettleResNormalized } from "@/lib/types/x402";
import { settleRequestSchema } from "@/lib/types/x402-schema";

const reconcileSchema = z.object({
  projectId: z.string().uuid(),
  fingerprint: z.string().min(1),
  connectionId: z.string().uuid().optional(),
});

type SettlementRequestPayload = z.infer<typeof settleRequestSchema>;

type ReconcileResult =
  | { status: "settled" | "failed"; success: boolean }
  | { status: "skipped" | "missing" | "invalid"; success: false }
  | { status: "unknown"; success: false };

function stripRawProvider<T extends { rawProvider?: unknown }>(value: T) {
  const { rawProvider: _rawProvider, ...safe } = value;
  return safe;
}

export const settlementReconcileTask = schemaTask({
  id: "settlement-reconcile",
  schema: reconcileSchema,
  run: async (payload): Promise<ReconcileResult> => {
    const rows = await db
      .select({
        status: settlementState.status,
        connectionId: settlementState.connectionId,
        requestEnc: settlementState.requestEnc,
      })
      .from(settlementState)
      .where(
        and(
          eq(settlementState.projectId, payload.projectId),
          eq(settlementState.fingerprint, payload.fingerprint)
        )
      )
      .limit(1);

    const state = rows[0];
    if (!state) {
      logger.warn("Settlement state missing", {
        projectId: payload.projectId,
        fingerprint: payload.fingerprint,
      });
      return { status: "missing", success: false };
    }

    if (state.status !== "unknown") {
      return { status: "skipped", success: false };
    }

    if (!state.connectionId) {
      await db
        .update(settlementState)
        .set({ status: "failed", updatedAt: new Date(), requestEnc: null })
        .where(
          and(
            eq(settlementState.projectId, payload.projectId),
            eq(settlementState.fingerprint, payload.fingerprint)
          )
        );
      return { status: "failed", success: false };
    }

    if (!state.requestEnc) {
      logger.warn("Settlement payload missing", {
        projectId: payload.projectId,
        fingerprint: payload.fingerprint,
      });
      return { status: "invalid", success: false };
    }

    const connectionRows = await db
      .select({
        id: facilitatorConnections.id,
        provider: facilitatorConnections.provider,
        credentialsEnc: facilitatorConnections.credentialsEnc,
      })
      .from(facilitatorConnections)
      .where(eq(facilitatorConnections.id, state.connectionId))
      .limit(1);

    const connection = connectionRows[0];
    if (!connection) {
      await db
        .update(settlementState)
        .set({ status: "failed", updatedAt: new Date(), requestEnc: null })
        .where(
          and(
            eq(settlementState.projectId, payload.projectId),
            eq(settlementState.fingerprint, payload.fingerprint)
          )
        );
      return { status: "failed", success: false };
    }

    let requestPayload: SettlementRequestPayload;
    try {
      requestPayload = settleRequestSchema.parse(
        decryptProjectPayload<SettlementRequestPayload>(
          payload.projectId,
          state.requestEnc as EncryptedPayload
        )
      );
    } catch {
      logger.warn("Settlement payload invalid", {
        projectId: payload.projectId,
        fingerprint: payload.fingerprint,
      });
      return { status: "invalid", success: false };
    }

    let response: SettleResNormalized;
    try {
      response = await getAdapter(connection.provider).settle(
        {
          projectId: payload.projectId,
          connectionId: connection.id,
          provider: connection.provider,
          credentials: decryptCredentials(
            payload.projectId,
            connection.credentialsEnc as EncryptedPayload
          ) as Record<string, unknown>,
        },
        requestPayload
      );
    } catch {
      await db
        .update(settlementState)
        .set({ status: "unknown", updatedAt: new Date() })
        .where(
          and(
            eq(settlementState.projectId, payload.projectId),
            eq(settlementState.fingerprint, payload.fingerprint)
          )
        );
      return { status: "unknown", success: false };
    }

    const safeResponse = stripRawProvider(response);
    const nextStatus = safeResponse.success ? "settled" : "failed";

    await db
      .update(settlementState)
      .set({ status: nextStatus, updatedAt: new Date(), requestEnc: null })
      .where(
        and(
          eq(settlementState.projectId, payload.projectId),
          eq(settlementState.fingerprint, payload.fingerprint)
        )
      );

    return { status: nextStatus, success: safeResponse.success };
  },
});
