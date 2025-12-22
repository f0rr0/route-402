import { pgEnum, pgTable, text, timestamp, boolean, jsonb, uuid, integer, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "viewer"]);
export const facilitatorProviderEnum = pgEnum("facilitator_provider", ["cdp", "thirdweb"]);
export const facilitatorStatusEnum = pgEnum("facilitator_status", ["unknown", "ok", "error"]);
export const routingEndpointEnum = pgEnum("routing_endpoint", ["verify", "settle"]);
export const settlementStatusEnum = pgEnum("settlement_status", ["pending", "unknown", "settled", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.userId] }),
  })
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
  })
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const facilitatorConnections = pgTable("facilitator_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  provider: facilitatorProviderEnum("provider").notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  credentialsEnc: jsonb("credentials_enc").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const facilitatorCapabilities = pgTable("facilitator_capabilities", {
  connectionId: uuid("connection_id").notNull().references(() => facilitatorConnections.id, { onDelete: "cascade" }).primaryKey(),
  supportedJson: jsonb("supported_json").notNull(),
  status: facilitatorStatusEnum("status").notNull().default("unknown"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  latencyP50Ms: integer("latency_p50_ms"),
  latencyP95Ms: integer("latency_p95_ms"),
});

export const routingRulesets = pgTable("routing_rulesets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  yamlText: text("yaml_text").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const routingDecisions = pgTable("routing_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  endpoint: routingEndpointEnum("endpoint").notNull(),
  connectionId: uuid("connection_id").references(() => facilitatorConnections.id, { onDelete: "set null" }),
  ruleName: text("rule_name"),
  fingerprint: text("fingerprint"),
  latencyMs: integer("latency_ms"),
  ok: boolean("ok").notNull().default(false),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settlementState = pgTable(
  "settlement_state",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    connectionId: uuid("connection_id").references(() => facilitatorConnections.id, { onDelete: "set null" }),
    status: settlementStatusEnum("status").notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.fingerprint] }),
    projectFingerprintIdx: uniqueIndex("settlement_project_fingerprint_idx").on(table.projectId, table.fingerprint),
  })
);
