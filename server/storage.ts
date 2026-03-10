import { db } from "./db";
import { and, eq } from "drizzle-orm";
import {
  settings,
  expenses,
  recurringBills,
  unlockedGoals,
  expenseTemplates,
  monthlySnapshots,
  paychecks,
  bankAccounts,
  type Settings,
  type Expense,
  type RecurringBill,
  type UnlockedGoal,
  type ExpenseTemplate,
  type MonthlySnapshot,
  type Paycheck,
  type BankAccount,
  type InsertBankAccount,
  type UpdateSettingsRequest,
  type CreateExpenseRequest,
  type CreateRecurringBillRequest,
  type UpdateRecurringBillRequest,
  type CreateUnlockedGoalRequest,
  type UpdateUnlockedGoalRequest,
  type CreatePaycheckRequest,
  type InsertExpenseTemplate,
} from "@shared/schema";
import { DEFAULT_FIXED_BILLS } from "@shared/default-bills";

// All userId params are now string (Supabase UUID)
export interface IStorage {
  seedDefaultsForUser(userId: string): Promise<void>;

  getSettings(userId: string): Promise<Settings>;
  updateSettings(userId: string, updates: UpdateSettingsRequest): Promise<Settings>;

  getExpenses(userId: string): Promise<Expense[]>;
  createExpense(userId: string, expense: CreateExpenseRequest): Promise<Expense>;
  deleteExpense(userId: string, id: number): Promise<void>;
  resetExpenses(userId: string): Promise<void>;

  getBills(userId: string): Promise<RecurringBill[]>;
  createBill(userId: string, bill: CreateRecurringBillRequest): Promise<RecurringBill>;
  updateBill(userId: string, id: number, updates: UpdateRecurringBillRequest): Promise<RecurringBill | undefined>;
  deleteBill(userId: string, id: number): Promise<void>;

  getGoals(userId: string): Promise<UnlockedGoal[]>;
  createGoal(userId: string, goal: CreateUnlockedGoalRequest): Promise<UnlockedGoal>;
  updateGoal(userId: string, id: number, updates: UpdateUnlockedGoalRequest): Promise<UnlockedGoal | undefined>;
  deleteGoal(userId: string, id: number): Promise<void>;

  getTemplates(userId: string): Promise<ExpenseTemplate[]>;
  createTemplate(userId: string, data: Omit<InsertExpenseTemplate, "userId">): Promise<ExpenseTemplate>;
  deleteTemplate(userId: string, id: number): Promise<void>;

  getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]>;
  saveMonthlySnapshot(userId: string, month: string, totalSpent: string, breakdown: string): Promise<MonthlySnapshot>;

  getPaychecks(userId: string): Promise<Paycheck[]>;
  createPaycheck(userId: string, paycheck: CreatePaycheckRequest): Promise<Paycheck>;
  deletePaycheck(userId: string, id: number): Promise<void>;

  getAccounts(userId: string): Promise<BankAccount[]>;
  createAccount(userId: string, data: Omit<InsertBankAccount, "userId">): Promise<BankAccount>;
  updateAccount(userId: string, id: number, updates: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteAccount(userId: string, id: number): Promise<void>;
}

const DEFAULT_UNLOCKED_GOALS: { name: string; cost: string; priority: string; note: string; useProtected: boolean }[] = [];

export class DatabaseStorage implements IStorage {
  async seedDefaultsForUser(userId: string): Promise<void> {
    const goals = await this.getGoals(userId);
    if (goals.length === 0) {
      for (const goal of DEFAULT_UNLOCKED_GOALS) await this.createGoal(userId, goal);
    }
    const bills = await this.getBills(userId);
    if (bills.length === 0) {
      for (const bill of DEFAULT_FIXED_BILLS) await this.createBill(userId, { ...bill, amount: bill.amount.toFixed(2), active: true });
    }
    await this.getSettings(userId); // creates default row if missing
  }

  async getSettings(userId: string): Promise<Settings> {
    const results = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
    if (results.length === 0) {
      const [newSettings] = await db.insert(settings).values({ userId }).returning();
      return newSettings;
    }
    return results[0];
  }

  async updateSettings(userId: string, updates: UpdateSettingsRequest): Promise<Settings> {
    const current = await this.getSettings(userId);
    const [updated] = await db.update(settings)
      .set(updates)
      .where(and(eq(settings.id, current.id), eq(settings.userId, userId)))
      .returning();
    return updated;
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.userId, userId));
  }

  async createExpense(userId: string, expense: CreateExpenseRequest): Promise<Expense> {
    const [created] = await db.insert(expenses).values({ ...expense, userId }).returning();
    return created;
  }

  async deleteExpense(userId: string, id: number): Promise<void> {
    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  }

  async resetExpenses(userId: string): Promise<void> {
    const currentExpenses = await this.getExpenses(userId);
    if (currentExpenses.length > 0) {
      const totalSpent = currentExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2);
      const breakdown: Record<string, number> = {};
      currentExpenses.forEach(e => { breakdown[e.allocId] = (breakdown[e.allocId] || 0) + Number(e.amount); });
      const month = new Date().toISOString().slice(0, 7);
      await this.saveMonthlySnapshot(userId, month, totalSpent, JSON.stringify(breakdown));
    }
    await db.delete(expenses).where(eq(expenses.userId, userId));
    await db.update(recurringBills).set({ paidMonth: "" }).where(eq(recurringBills.userId, userId));
    const currentMonth = new Date().toISOString().slice(0, 7);
    await db.update(recurringBills).set({ paidMonth: currentMonth }).where(and(eq(recurringBills.userId, userId), eq(recurringBills.autopay, true)));
  }

  async getBills(userId: string): Promise<RecurringBill[]> {
    return await db.select().from(recurringBills).where(eq(recurringBills.userId, userId));
  }

  async createBill(userId: string, bill: CreateRecurringBillRequest): Promise<RecurringBill> {
    const [created] = await db.insert(recurringBills).values({ ...bill, userId }).returning();
    return created;
  }

  async updateBill(userId: string, id: number, updates: UpdateRecurringBillRequest): Promise<RecurringBill | undefined> {
    const [updated] = await db.update(recurringBills)
      .set(updates)
      .where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)))
      .returning();
    return updated;
  }

  async deleteBill(userId: string, id: number): Promise<void> {
    await db.delete(recurringBills).where(and(eq(recurringBills.id, id), eq(recurringBills.userId, userId)));
  }

  async getGoals(userId: string): Promise<UnlockedGoal[]> {
    return await db.select().from(unlockedGoals).where(eq(unlockedGoals.userId, userId));
  }

  async createGoal(userId: string, goal: CreateUnlockedGoalRequest): Promise<UnlockedGoal> {
    const [created] = await db.insert(unlockedGoals).values({ ...goal, userId }).returning();
    return created;
  }

  async updateGoal(userId: string, id: number, updates: UpdateUnlockedGoalRequest): Promise<UnlockedGoal | undefined> {
    const [updated] = await db.update(unlockedGoals)
      .set(updates)
      .where(and(eq(unlockedGoals.id, id), eq(unlockedGoals.userId, userId)))
      .returning();
    return updated;
  }

  async deleteGoal(userId: string, id: number): Promise<void> {
    await db.delete(unlockedGoals).where(and(eq(unlockedGoals.id, id), eq(unlockedGoals.userId, userId)));
  }

  async getTemplates(userId: string): Promise<ExpenseTemplate[]> {
    return await db.select().from(expenseTemplates).where(eq(expenseTemplates.userId, userId));
  }

  async createTemplate(userId: string, data: Omit<InsertExpenseTemplate, "userId">): Promise<ExpenseTemplate> {
    const [created] = await db.insert(expenseTemplates).values({ ...data, userId }).returning();
    return created;
  }

  async deleteTemplate(userId: string, id: number): Promise<void> {
    await db.delete(expenseTemplates).where(and(eq(expenseTemplates.id, id), eq(expenseTemplates.userId, userId)));
  }

  async getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]> {
    return await db.select().from(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
  }

  async saveMonthlySnapshot(userId: string, month: string, totalSpent: string, breakdown: string): Promise<MonthlySnapshot> {
    const existing = await db.select().from(monthlySnapshots)
      .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.month, month)))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(monthlySnapshots)
        .set({ totalSpent, breakdown, savedAt: new Date().toISOString() })
        .where(and(eq(monthlySnapshots.id, existing[0].id), eq(monthlySnapshots.userId, userId)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(monthlySnapshots)
      .values({ userId, month, totalSpent, breakdown, savedAt: new Date().toISOString() })
      .returning();
    return created;
  }

  async getPaychecks(userId: string): Promise<Paycheck[]> {
    return await db.select().from(paychecks).where(eq(paychecks.userId, userId));
  }

  async createPaycheck(userId: string, paycheck: CreatePaycheckRequest): Promise<Paycheck> {
    const [created] = await db.insert(paychecks)
      .values({ ...paycheck, userId, createdAt: new Date().toISOString() })
      .returning();
    return created;
  }

  async deletePaycheck(userId: string, id: number): Promise<void> {
    await db.delete(paychecks).where(and(eq(paychecks.id, id), eq(paychecks.userId, userId)));
  }

  async getAccounts(userId: string): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  }

  async createAccount(userId: string, data: Omit<InsertBankAccount, "userId">): Promise<BankAccount> {
    const [created] = await db.insert(bankAccounts).values({ ...data, userId }).returning();
    return created;
  }

  async updateAccount(userId: string, id: number, updates: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const [updated] = await db.update(bankAccounts)
      .set(updates)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))
      .returning();
    return updated;
  }

  async deleteAccount(userId: string, id: number): Promise<void> {
    await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
