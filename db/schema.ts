import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const sessions = sqliteTable("persona_sessions", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  version: integer("version").notNull().default(0),
  expires: integer("expires").notNull(),
  oauthState: text("oauth_state"),
  oauthVerifier: text("oauth_verifier"),
  oauthExpires: integer("oauth_expires"),
  credentials: text("credentials"),
  turnLock: text("turn_lock"),
  lockUntil: integer("lock_until").notNull().default(0),
});
