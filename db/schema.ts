import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  birthYear: integer('birth_year'),
  birthMonth: integer('birth_month'),
  isAgeVerified: integer('is_age_verified').default(0),
  goldCoins: real('gold_coins').default(1000),
  novaCrystals: real('nova_crystals').default(0),
  vipTier: text('vip_tier').default('Stardust'),
  vipProgress: real('vip_progress').default(0),
  totalWagered: real('total_wagered').default(0),
  totalWon: real('total_won').default(0),
  gamesPlayed: integer('games_played').default(0),
  soundEnabled: integer('sound_enabled').default(1),
  chatEnabled: integer('chat_enabled').default(1),
  selfExclusionUntil: text('self_exclusion_until'),
  selfExclusionRemovalRequestedAt: text('self_exclusion_removal_requested_at'),
  sessionLimitMinutes: integer('session_limit_minutes'),
  role: text('role').default('user'),
  rakebackPercent: real('rakeback_percent').default(0),
  tosAcceptedAt: text('tos_accepted_at'),
  tosVersion: text('tos_version'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  googleId: text('google_id'),
  discordId: text('discord_id'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  googleIdIdx: index('users_google_id_idx').on(table.googleId),
  discordIdIdx: index('users_discord_id_idx').on(table.discordId),
}))

// ─── AMOE Requests ───────────────────────────────────────────────────────────
export const amoeRequests = sqliteTable('amoe_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  address: text('address').notNull(),
  status: text('status').default('pending'),
  requestedAt: text('requested_at').default(sql`(datetime('now'))`),
  fulfilledAt: text('fulfilled_at'),
}, (table) => ({
  userIdIdx: index('amoe_user_id_idx').on(table.userId),
}))

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  target: text('target').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  timestamp: text('timestamp').default(sql`(datetime('now'))`),
}, (table) => ({
  adminIdIdx: index('audit_admin_id_idx').on(table.adminId),
  timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
}))

// ─── Game History ─────────────────────────────────────────────────────────────
export const gameHistory = sqliteTable('game_history', {
  id: text('id').primaryKey(),
  gameType: text('game_type').notNull(),
  crashPoint: real('crash_point'),
  serverSeed: text('server_seed'),
  serverSeedHash: text('server_seed_hash'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => ({
  gameTypeIdx: index('game_history_type_idx').on(table.gameType),
  createdAtIdx: index('game_history_created_at_idx').on(table.createdAt),
}))

// ─── Type Exports ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AmoeRequest = typeof amoeRequests.$inferSelect
export type NewAmoeRequest = typeof amoeRequests.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type GameHistory = typeof gameHistory.$inferSelect
export type NewGameHistory = typeof gameHistory.$inferInsert
