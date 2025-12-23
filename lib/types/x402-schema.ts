import { z } from "zod";

export const paymentRequirementsSchema = z.object({
  scheme: z.string().min(1),
  network: z.string().optional(),
  asset: z.string().optional(),
  amount: z.string().optional(),
  payTo: z.string().optional(),
});

export const verifyRequestSchema = z.object({
  paymentRequirements: paymentRequirementsSchema,
  paymentPayload: z.unknown().optional(),
});

export const settleRequestSchema = z.object({
  paymentRequirements: paymentRequirementsSchema,
  paymentPayload: z.unknown(),
});
