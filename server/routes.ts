import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { requireAuth } from "./auth";

function getUserId(req: Request): string {
  return (req as any).user?.id as string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Seed endpoint ──────────────────────────────────────────────────────────
  // Called once after first sign-up to create default bills/goals/settings.
  // Protected by the same requireAuth middleware.
  app.post("/api/seed", requireAuth, async (req, res) => {
    try {
      await storage.seedDefaultsForUser(getUserId(req));
      res.json({ message: "Seeded" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Protect all /api routes ────────────────────────────────────────────────
  app.use("/api", requireAuth);

  // ─── Settings ───────────────────────────────────────────────────────────────
  app.get(api.settings.get.path, async (req, res) => {
    const s = await storage.getSettings(getUserId(req));
    res.json(s);
  });

  app.put(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSettings(getUserId(req), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  // ─── Expenses ────────────────────────────────────────────────────────────────
  app.get(api.expenses.list.path, async (req, res) => {
    const exps = await storage.getExpenses(getUserId(req));
    res.json(exps);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    try {
      const input = api.expenses.create.input.parse(req.body);
      const created = await storage.createExpense(getUserId(req), input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
    await storage.deleteExpense(getUserId(req), id);
    res.status(204).end();
  });

  app.post(api.expenses.reset.path, async (req, res) => {
    await storage.resetExpenses(getUserId(req));
    res.json({ message: "Expenses reset" });
  });

  // ─── Bills ───────────────────────────────────────────────────────────────────
  app.get(api.bills.list.path, async (req, res) => {
    const bills = await storage.getBills(getUserId(req));
    res.json(bills);
  });

  app.post(api.bills.create.path, async (req, res) => {
    try {
      const input = api.bills.create.input.extend({ amount: z.coerce.string(), dueDay: z.coerce.number().int().min(1).max(31) }).parse(req.body);
      const created = await storage.createBill(getUserId(req), input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.put(api.bills.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
      const input = api.bills.update.input.extend({ amount: z.coerce.string().optional(), dueDay: z.coerce.number().int().min(1).max(31).optional() }).parse(req.body);
      const updated = await storage.updateBill(getUserId(req), id, input);
      if (!updated) return res.status(404).json({ message: "Bill not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.delete(api.bills.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
    await storage.deleteBill(getUserId(req), id);
    res.status(204).end();
  });

  // ─── Goals ───────────────────────────────────────────────────────────────────
  app.get(api.goals.list.path, async (req, res) => {
    const goals = await storage.getGoals(getUserId(req));
    res.json(goals);
  });

  app.post(api.goals.create.path, async (req, res) => {
    try {
      const input = api.goals.create.input.parse(req.body);
      const created = await storage.createGoal(getUserId(req), input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.put(api.goals.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
      const input = api.goals.update.input.parse(req.body);
      const updated = await storage.updateGoal(getUserId(req), id, input);
      if (!updated) return res.status(404).json({ message: "Goal not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.delete(api.goals.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
    await storage.deleteGoal(getUserId(req), id);
    res.status(204).end();
  });

  // ─── Templates ───────────────────────────────────────────────────────────────
  app.get(api.templates.list.path, async (req, res) => {
    const templates = await storage.getTemplates(getUserId(req));
    res.json(templates);
  });

  app.post(api.templates.create.path, async (req, res) => {
    try {
      const input = api.templates.create.input.parse(req.body);
      const created = await storage.createTemplate(getUserId(req), input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.delete(api.templates.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: "Invalid ID" });
    await storage.deleteTemplate(getUserId(req), id);
    res.status(204).end();
  });

  // ─── Snapshots ───────────────────────────────────────────────────────────────
  app.get(api.snapshots.list.path, async (req, res) => {
    const snaps = await storage.getMonthlySnapshots(getUserId(req));
    res.json(snaps);
  });

  // ─── Paychecks ───────────────────────────────────────────────────────────────
  app.get(api.paychecks.list.path, async (req, res) => {
    const rows = await storage.getPaychecks(getUserId(req));
    res.json(rows);
  });

  app.post(api.paychecks.create.path, async (req, res) => {
    try {
      const input = api.paychecks.create.input.extend({
        grossPay: z.coerce.string(),
        netPay: z.coerce.string(),
        taxesTotal: z.coerce.string().optional(),
        deductionsTotal: z.coerce.string().optional(),
      }).parse(req.body);
      const created = await storage.createPaycheck(getUserId(req), {
        ...input,
        taxesTotal: input.taxesTotal || '0.00',
        deductionsTotal: input.deductionsTotal || '0.00',
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.delete(api.paychecks.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ message: 'Invalid ID' });
    await storage.deletePaycheck(getUserId(req), id);
    res.status(204).end();
  });

  // ─── Accounts ────────────────────────────────────────────────────────────────
  app.get(api.accounts.list.path, async (req, res) => {
    const accounts = await storage.getAccounts(getUserId(req));
    res.json(accounts);
  });

  app.post(api.accounts.create.path, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const created = await storage.createAccount(getUserId(req), input);
      res.status(201).json(created);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put(api.accounts.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.accounts.update.input.parse(req.body);
      const updated = await storage.updateAccount(getUserId(req), id, input);
      if (!updated) return res.status(404).json({ message: "Account not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete(api.accounts.delete.path, async (req, res) => {
    await storage.deleteAccount(getUserId(req), parseInt(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}
