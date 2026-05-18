import { pgTable, serial, text, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  otp: varchar('otp', { length: 6 }),
  otp_expiry: timestamp('otp_expiry'),
  is_verified: boolean('is_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  complaintText: text('complaint_text').notNull(),
  aiQuestion: text('ai_question').notNull(),
  userAnswer: text('user_answer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
