"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeOrRedirect } from "@/lib/rbac/authorize";
import {
  createConnection,
  deleteConnection,
  setConnectionEnabled,
  testConnection,
} from "@/lib/facilitators/service";
import { facilitatorProviderSchema } from "@/lib/types/credentials";
import { tasks } from "@trigger.dev/sdk";

const baseSchema = z.object({
  projectId: z.uuid(),
  name: z.string().min(1),
  provider: facilitatorProviderSchema,
});

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

export async function createConnectionAction(formData: FormData) {
  const input = baseSchema.parse({
    projectId: getString(formData, "projectId"),
    name: getString(formData, "name"),
    provider: getString(formData, "provider"),
  });

  const enabled = getString(formData, "enabled") === "on";

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: input.projectId,
    minRole: "admin",
  });

  const credentials =
    input.provider === "cdp"
      ? {
          apiKey: getString(formData, "cdpApiKey"),
          apiSecret: getString(formData, "cdpApiSecret"),
          baseUrl: getOptionalString(formData, "cdpBaseUrl"),
        }
      : input.provider === "thirdweb"
        ? {
            walletSecret: getString(formData, "thirdwebWalletSecret"),
            baseUrl: getOptionalString(formData, "thirdwebBaseUrl"),
          }
        : {
            baseUrl: getOptionalString(formData, "mogamiBaseUrl"),
          };

  const connectionId = await createConnection({
    projectId: input.projectId,
    provider: input.provider,
    name: input.name,
    enabled,
    credentials,
  });

  if (connectionId) {
    try {
      await tasks.trigger("capability-refresh", {
        projectId: input.projectId,
        connectionId,
      });
    } catch {
      // Capability refresh is best-effort.
    }
  }

  revalidatePath(`/projects/${input.projectId}/facilitators`);
}

export async function toggleConnectionAction(formData: FormData) {
  const input = z
    .object({
      projectId: z.uuid(),
      connectionId: z.uuid(),
      enabled: z.enum(["true", "false"]),
    })
    .parse({
      projectId: getString(formData, "projectId"),
      connectionId: getString(formData, "connectionId"),
      enabled: getString(formData, "enabled"),
    });

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: input.projectId,
    minRole: "admin",
  });

  await setConnectionEnabled({
    projectId: input.projectId,
    connectionId: input.connectionId,
    enabled: input.enabled === "true",
  });

  revalidatePath(`/projects/${input.projectId}/facilitators`);
}

export async function testConnectionAction(formData: FormData) {
  const input = z
    .object({
      projectId: z.string().uuid(),
      connectionId: z.string().uuid(),
    })
    .parse({
      projectId: getString(formData, "projectId"),
      connectionId: getString(formData, "connectionId"),
    });

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: input.projectId,
    minRole: "admin",
  });

  try {
    await testConnection({
      projectId: input.projectId,
      connectionId: input.connectionId,
    });
  } catch (error) {
    console.error("Failed to test facilitator connection", error);
  }

  revalidatePath(`/projects/${input.projectId}/facilitators`);
}

export async function deleteConnectionAction(formData: FormData) {
  const input = z
    .object({
      projectId: z.string().uuid(),
      connectionId: z.string().uuid(),
    })
    .parse({
      projectId: getString(formData, "projectId"),
      connectionId: getString(formData, "connectionId"),
    });

  const requestHeaders = await headers();
  await authorizeOrRedirect({
    headers: requestHeaders,
    projectId: input.projectId,
    minRole: "admin",
  });

  await deleteConnection({
    projectId: input.projectId,
    connectionId: input.connectionId,
  });

  revalidatePath(`/projects/${input.projectId}/facilitators`);
}
