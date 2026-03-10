import { z } from 'zod';
import { insertSettingsSchema, insertExpenseSchema, insertRecurringBillSchema, insertUnlockedGoalSchema, insertExpenseTemplateSchema, insertBankAccountSchema, insertPaycheckSchema, settings, expenses, recurringBills, unlockedGoals, expenseTemplates, monthlySnapshots, paychecks, bankAccounts, authCredentialsSchema, authUserResponseSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    me: { method: 'GET' as const, path: '/api/auth/me' as const, responses: { 200: authUserResponseSchema, 401: errorSchemas.unauthorized } },
    register: { method: 'POST' as const, path: '/api/auth/register' as const, input: authCredentialsSchema, responses: { 201: authUserResponseSchema, 400: errorSchemas.validation } },
    login: { method: 'POST' as const, path: '/api/auth/login' as const, input: authCredentialsSchema, responses: { 200: authUserResponseSchema, 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    logout: { method: 'POST' as const, path: '/api/auth/logout' as const, responses: { 200: z.object({ message: z.string() }) } },
    changePassword: { method: 'POST' as const, path: '/api/auth/change-password' as const, input: z.object({ oldPassword: z.string(), newPassword: z.string().min(6) }), responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    deleteAccount: { method: 'DELETE' as const, path: '/api/auth/account' as const, responses: { 200: z.object({ message: z.string() }), 401: errorSchemas.unauthorized } },
  },
  settings: {
    get: { method: 'GET' as const, path: '/api/settings' as const, responses: { 200: z.custom<typeof settings.$inferSelect>(), 401: errorSchemas.unauthorized } },
    update: { method: 'PUT' as const, path: '/api/settings' as const, input: insertSettingsSchema.partial(), responses: { 200: z.custom<typeof settings.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
  },
  expenses: {
    list: { method: 'GET' as const, path: '/api/expenses' as const, responses: { 200: z.array(z.custom<typeof expenses.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/expenses' as const, input: insertExpenseSchema, responses: { 201: z.custom<typeof expenses.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/expenses/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
    reset: { method: 'POST' as const, path: '/api/expenses/reset' as const, responses: { 200: z.object({ message: z.string() }), 401: errorSchemas.unauthorized } }
  },
  bills: {
    list: { method: 'GET' as const, path: '/api/bills' as const, responses: { 200: z.array(z.custom<typeof recurringBills.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/bills' as const, input: insertRecurringBillSchema, responses: { 201: z.custom<typeof recurringBills.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    update: { method: 'PUT' as const, path: '/api/bills/:id' as const, input: insertRecurringBillSchema.partial(), responses: { 200: z.custom<typeof recurringBills.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/bills/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
  },
  goals: {
    list: { method: 'GET' as const, path: '/api/goals' as const, responses: { 200: z.array(z.custom<typeof unlockedGoals.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/goals' as const, input: insertUnlockedGoalSchema, responses: { 201: z.custom<typeof unlockedGoals.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    update: { method: 'PUT' as const, path: '/api/goals/:id' as const, input: insertUnlockedGoalSchema.partial(), responses: { 200: z.custom<typeof unlockedGoals.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/goals/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
  },
  templates: {
    list: { method: 'GET' as const, path: '/api/expense-templates' as const, responses: { 200: z.array(z.custom<typeof expenseTemplates.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/expense-templates' as const, input: insertExpenseTemplateSchema, responses: { 201: z.custom<typeof expenseTemplates.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/expense-templates/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
  },
  snapshots: {
    list: { method: 'GET' as const, path: '/api/monthly-snapshots' as const, responses: { 200: z.array(z.custom<typeof monthlySnapshots.$inferSelect>()), 401: errorSchemas.unauthorized } },
  },
  paychecks: {
    list: { method: 'GET' as const, path: '/api/paychecks' as const, responses: { 200: z.array(z.custom<typeof paychecks.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/paychecks' as const, input: insertPaycheckSchema, responses: { 201: z.custom<typeof paychecks.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/paychecks/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
  },
  accounts: {
    list: { method: 'GET' as const, path: '/api/accounts' as const, responses: { 200: z.array(z.custom<typeof bankAccounts.$inferSelect>()), 401: errorSchemas.unauthorized } },
    create: { method: 'POST' as const, path: '/api/accounts' as const, input: insertBankAccountSchema, responses: { 201: z.custom<typeof bankAccounts.$inferSelect>(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized } },
    update: { method: 'PUT' as const, path: '/api/accounts/:id' as const, input: insertBankAccountSchema.partial(), responses: { 200: z.custom<typeof bankAccounts.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
    delete: { method: 'DELETE' as const, path: '/api/accounts/:id' as const, responses: { 204: z.void(), 404: errorSchemas.notFound, 401: errorSchemas.unauthorized } },
  },
};

export type UpdateSettingsRequest = z.infer<typeof api.settings.update.input>;
export type CreateExpenseRequest = z.infer<typeof api.expenses.create.input>;
export type CreateUnlockedGoalRequest = z.infer<typeof api.goals.create.input>;
export type UpdateUnlockedGoalRequest = z.infer<typeof api.goals.update.input>;
export type CreatePaycheckRequest = z.infer<typeof api.paychecks.create.input>;
export type AuthCredentialsRequest = z.infer<typeof api.auth.login.input>;

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}
