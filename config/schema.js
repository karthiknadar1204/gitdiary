import { pgTable, varchar, timestamp, serial, text, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const repos = pgTable("repos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  owner: varchar("owner").notNull(),
  name: varchar("name").notNull(),
  url: varchar("url").notNull(),
  defaultBranch: varchar("default_branch"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").references(() => repos.id).notNull(),
  path: varchar("path").notNull(),
  type: varchar("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commits = pgTable("commits", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").references(() => repos.id).notNull(),
  sha: varchar("sha").notNull().unique(),
  message: text("message"),
  authorName: varchar("author_name"),
  authorEmail: varchar("author_email"),
  date: timestamp("date"),
  filesChanged: jsonb("files_changed"),
});

export const pullRequests = pgTable("pull_requests", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").references(() => repos.id).notNull(),
  number: integer("number").notNull(),
  title: varchar("title").notNull(),
  body: text("body"),
  state: varchar("state"),
  createdAt: timestamp("created_at"),
  mergedAt: timestamp("merged_at"),
});

export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").references(() => repos.id).notNull(),
  number: integer("number").notNull(),
  title: varchar("title").notNull(),
  body: text("body"),
  state: varchar("state"),
  createdAt: timestamp("created_at"),
  closedAt: timestamp("closed_at"),
});


export const commitToPR = pgTable("commit_to_pr", {
  commitId: integer("commit_id").references(() => commits.id).notNull(),
  prId: integer("pr_id").references(() => pullRequests.id).notNull(),
}, (t) => ({
  pk: primaryKey(t.commitId, t.prId)
}));

export const prToIssue = pgTable("pr_to_issue", {
  prId: integer("pr_id").references(() => pullRequests.id).notNull(),
  issueId: integer("issue_id").references(() => issues.id).notNull(),
}, (t) => ({
  pk: primaryKey(t.prId, t.issueId)
}));

export const explanations = pgTable("explanations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fileId: integer("file_id").references(() => files.id),
  commitIds: jsonb("commit_ids"),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
