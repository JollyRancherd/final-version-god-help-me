import { pgTable, text, serial, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NOTE: The old `users` table is no longer needed — Supabase auth manages users.
// We keep a lightweight `profiles` reference if you want to store extra data per user.

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),            // Supabase UUID
  phase: integer("phase").notNull().default(1),
  paycheck: numeric("paycheck", { precision: 10, scale: 2 }).notNull().default("1000.00"),
  checkingBalance: numeric("checking_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  nextPayday: text("next_payday").notNull().default(""),
  emergencyFund: numeric("emergency_fund", { precision: 10, scale: 2 }).notNull().default("0.00"),
  apartmentFund: numeric("apartment_fund", { precision: 10, scale: 2 }).notNull().default("0.00"),
  debtPaid: numeric("debt_paid", { precision: 10, scale: 2 }).notNull().default("0.00"),
  savingsFund: numeric("savings_fund", { precision: 10, scale: 2 }).notNull().default("0.00"),
  rolloverPool: numeric("rollover_pool", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalDebt: numeric("total_debt", { precision: 10, scale: 2 }).notNull().default("0.00"),
  emergencyGoal: numeric("emergency_goal", { precision: 10, scale: 2 }).notNull().default("1000.00"),
  apartmentGoal: numeric("apartment_goal", { precision: 10, scale: 2 }).notNull().default("3000.00"),
  bigGoalName: text("big_goal_name").notNull().default("Big Goal"),
  allocOverrides: text("alloc_overrides").notNull().default("{}"),
  allocNames: text("alloc_names").notNull().default("{}"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  allocId: text("alloc_id").notNull(),
  date: text("date").notNull(),
  note: text("note"),
});

export const recurringBills = pgTable("recurring_bills", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  icon: text("icon").notNull().default("💸"),
  note: text("note").notNull().default(""),
  dueDay: integer("due_day").notNull(),
  active: boolean("active").notNull().default(true),
  autopay: boolean("autopay").notNull().default(false),
  paidMonth: text("paid_month").notNull().default(""),
});

export const unlockedGoals = pgTable("unlocked_goals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  name: text("name").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  priority: text("priority").notNull().default("Medium"),
  note: text("note"),
  useProtected: boolean("use_protected").default(false).notNull(),
  contributed: numeric("contributed", { precision: 10, scale: 2 }).notNull().default("0.00"),
  targetDate: text("target_date"),
  locked: boolean("locked").default(false).notNull(),
});

export const expenseTemplates = pgTable("expense_templates", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  allocId: text("alloc_id").notNull(),
  icon: text("icon").notNull().default("📝"),
});

export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  month: text("month").notNull(),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).notNull().default("0.00"),
  breakdown: text("breakdown").notNull().default("{}"),
  savedAt: text("saved_at").notNull().default(""),
});

export const paychecks = pgTable("paychecks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  payDate: text("pay_date").notNull(),
  grossPay: numeric("gross_pay", { precision: 10, scale: 2 }).notNull(),
  netPay: numeric("net_pay", { precision: 10, scale: 2 }).notNull(),
  taxesTotal: numeric("taxes_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deductionsTotal: numeric("deductions_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lineItems: text("line_items").notNull().default("[]"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").$type<string>().notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("checking"),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  icon: text("icon").notNull().default("🏦"),
  color: text("color").notNull().default("hsl(var(--primary))"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Insert Schemas ────────────────────────────────────────────────────────────

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, userId: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, userId: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, userId: true });
export const insertRecurringBillSchema = createInsertSchema(recurringBills).omit({ id: true, userId: true });
export const insertUnlockedGoalSchema = createInsertSchema(unlockedGoals).omit({ id: true, userId: true });
export const insertExpenseTemplateSchema = createInsertSchema(expenseTemplates).omit({ id: true, userId: true });
export const insertMonthlySnapshotSchema = createInsertSchema(monthlySnapshots).omit({ id: true, userId: true });
export const insertPaycheckSchema = createInsertSchema(paychecks).omit({ id: true, userId: true, createdAt: true });

export const authCredentialsSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(40, "Username is too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password is too long"),
});

export const authUserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type RecurringBill = typeof recurringBills.$inferSelect;
export type InsertRecurringBill = z.infer<typeof insertRecurringBillSchema>;
export type UnlockedGoal = typeof unlockedGoals.$inferSelect;
export type InsertUnlockedGoal = z.infer<typeof insertUnlockedGoalSchema>;
export type ExpenseTemplate = typeof expenseTemplates.$inferSelect;
export type InsertExpenseTemplate = z.infer<typeof insertExpenseTemplateSchema>;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = z.infer<typeof insertMonthlySnapshotSchema>;
export type Paycheck = typeof paychecks.$inferSelect;
export type InsertPaycheck = z.infer<typeof insertPaycheckSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

export type UpdateSettingsRequest = Partial<InsertSettings>;
export type CreateExpenseRequest = InsertExpense;
export type CreateRecurringBillRequest = InsertRecurringBill;
export type UpdateRecurringBillRequest = Partial<InsertRecurringBill>;
export type CreateUnlockedGoalRequest = InsertUnlockedGoal;
export type UpdateUnlockedGoalRequest = Partial<InsertUnlockedGoal>;
export type CreatePaycheckRequest = InsertPaycheck;
export type AuthCredentialsRequest = z.infer<typeof authCredentialsSchema>;
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
