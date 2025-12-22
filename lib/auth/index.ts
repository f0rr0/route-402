import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const betterAuthUrl = env.BETTER_AUTH_URL;
const betterAuthSecret = env.BETTER_AUTH_SECRET;

if (!betterAuthUrl) {
  throw new Error("BETTER_AUTH_URL is not set");
}

if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

export const auth = betterAuth({
  baseURL: betterAuthUrl,
  secret: betterAuthSecret,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.User;
