import { z } from "zod";

export const facilitatorProviderSchema = z.enum(["cdp", "thirdweb", "mogami"]);
export type FacilitatorProvider = z.infer<typeof facilitatorProviderSchema>;

export const cdpCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  baseUrl: z.url().optional(),
});

export const thirdwebCredentialsSchema = z.object({
  walletSecret: z.string().min(1),
  baseUrl: z.url().optional(),
});

export const mogamiCredentialsSchema = z.object({
  baseUrl: z.url().optional(),
});

export type CdpCredentials = z.infer<typeof cdpCredentialsSchema>;
export type ThirdwebCredentials = z.infer<typeof thirdwebCredentialsSchema>;
export type MogamiCredentials = z.infer<typeof mogamiCredentialsSchema>;

export const credentialsSchemaByProvider = {
  cdp: cdpCredentialsSchema,
  thirdweb: thirdwebCredentialsSchema,
  mogami: mogamiCredentialsSchema,
};

export type ProviderCredentials =
  | CdpCredentials
  | ThirdwebCredentials
  | MogamiCredentials;
