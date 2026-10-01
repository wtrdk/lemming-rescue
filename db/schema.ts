import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const progress = sqliteTable('progress', {
  levelId: text('level_id').primaryKey(),
  saved: integer('saved').notNull(),
  total: integer('total').notNull(),
  percent: integer('percent').notNull(),
  completed: integer('completed', {mode:'boolean'}).notNull(),
  ticks: integer('ticks').notNull(),
  replay: text('replay').notNull(),
  updatedAt: text('updated_at').notNull()
});
