import React, { useEffect, useMemo, useState } from "react";
import { formatMoney, getSafeToSpend, getDailySafeSpend, calcDaysUntil, getEntertainmentUnused, getMonthlyGoalPace, getReservedMoney, getSpentThisMonth, getDebtRemaining, getAllocs, getSpentByAlloc, PRIORITY_ORDER, getBudgetVsActualData, getSpendingMixData, getSavingsRate, getNetWorthBreakdown, getTopSpendingInsights, getGoalForecastDetails, getMonthlyReportCard, getDebtPayoffSummary, buildSmartSweepPlan } from "@/lib/budget-utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useExpenses, useCreateExpense, useMonthlySnapshots, useResetExpenses } from "@/hooks/use-expenses";
import { useBills } from "@/hooks/use-bills";
import { useAccounts } from "@/hooks/use-accounts";
import { useGoals } from "@/hooks/use-goals";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TriangleAlert, X, Wallet, TrendingUp, TrendingDown, Plus, BellRing, AlertCircle, RotateCcw, Lock, CalendarClock } from "lucide-react";

const currentMonthKey = new Date().toISOString().slice(0, 7);

const getSweepCycleKey = (nextPayday?: string | null) => nextPayday ? `payday:${nextPayday}` : `month:${currentMonthKey}`;

export function DashboardTab() {
  const { data: settings, isLoading: loadingSettings } = useSettings();
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const { data: bills, isLoading: loadingBills } = useBills();
  const { data: accounts } = useAccounts();
  const { data: goals } = useGoals();
  const { data: authUser } = useAuth();
  const { data: snapshots } = useMonthlySnapshots();
  const { toast } = useToast();
  const updateSettings = useUpdateSettings();

  const createExpense = useCreateExpense();
  const resetExpenses = useResetExpenses();
  const [checkingInput, setCheckingInput] = useState("");
  const [paydayInput, setPaydayInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaAmount, setQaAmount] = useState("");
  const [qaAllocId, setQaAllocId] = useState("");
  const [appliedSweepCycle, setAppliedSweepCycle] = useState<string | null>(null);
  const [showCloseoutConfirm, setShowCloseoutConfirm] = useState(false);


  useEffect(() => {
    try {
      setAppliedSweepCycle(localStorage.getItem(`budget_last_sweep_cycle:${authUser?.id || "guest"}`));
    } catch {
      setAppliedSweepCycle(null);
    }
  }, [authUser?.id]);

  const overdueBills = useMemo(() => {
    if (!bills) return [];
    return bills.filter(b => {
      if (b.active === false) return false;
      if ((b as any).paidMonth === currentMonthKey) return false;
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), b.dueDay, 12);
      const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
      const days = Math.ceil((dueDate.getTime() - todayNoon.getTime()) / 86400000);
      return days <= 3;
    });
  }, [bills]);

  const payCycleData = useMemo(() => {
    if (!settings?.nextPayday) return null;
    const next = new Date(settings.nextPayday + "T12:00:00");
    const cycleStart = new Date(next.getTime() - 14 * 86400000);
    const today = new Date();
    const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    const elapsed = Math.max(0, Math.floor((todayNoon.getTime() - cycleStart.getTime()) / 86400000));
    const total = 14;
    const pct = Math.min(100, Math.round((elapsed / total) * 100));
    return { elapsed, total, pct };
  }, [settings?.nextPayday]);

  const dailyBurnRate = useMemo(() => {
    const elapsed = payCycleData?.elapsed || 0;
    const spent = getSpentThisMonth(expenses || []);
    return elapsed > 0 ? spent / elapsed : 0;
  }, [payCycleData, expenses]);

  const netWorth = useMemo(() => {
    if (!settings) return null;
    const assets =
      Number(settings.checkingBalance || 0) +
      Number(settings.emergencyFund || 0) +
      Number(settings.apartmentFund || 0) +
      Number(settings.savingsFund || 0) +
      Number(settings.rolloverPool || 0);
    const debt = getDebtRemaining(settings);
    return { assets, debt, total: assets - debt };
  }, [settings]);

  const allocs = useMemo(() => getAllocs(settings?.phase || 1, (settings as any)?.allocOverrides, (settings as any)?.allocNames), [settings?.phase, (settings as any)?.allocOverrides, (settings as any)?.allocNames]);

  const surplusTracker = useMemo(() => {
    if (!settings || !expenses) return null;
    const budgeted = allocs.filter(a => a.recommended > 0).reduce((s, a) => s + a.recommended, 0);
    const actual = getSpentThisMonth(expenses);
    const surplus = budgeted - actual;
    const topGoal = [...(goals || [])].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)).find(g => !(g as any).locked && Number((g as any).contributed || 0) < Number(g.cost));
    return { budgeted, actual, surplus, topGoal };
  }, [settings, allocs, expenses, goals]);

  const budgetChartData = useMemo(() => getBudgetVsActualData(settings, expenses || []), [settings, expenses]);
  const spendingMix = useMemo(() => getSpendingMixData(settings, expenses || []), [settings, expenses]);
  const savingsRate = useMemo(() => getSavingsRate(settings, expenses || []), [settings, expenses]);
  const netWorthSummary = useMemo(() => getNetWorthBreakdown(settings, accounts || []), [settings, accounts]);
  const insights = useMemo(() => getTopSpendingInsights(settings, expenses || [], bills), [settings, expenses, bills]);
  const goalForecast = useMemo(() => getGoalForecastDetails(goals || [], settings, expenses || [], bills).slice(0, 3), [goals, settings, expenses, bills]);
  const monthlyReport = useMemo(() => getMonthlyReportCard(settings, expenses || [], bills), [settings, expenses, bills]);
  const debtSummary = useMemo(() => getDebtPayoffSummary(settings, expenses || [], bills), [settings, expenses, bills]);
  const smartSweep = useMemo(() => buildSmartSweepPlan(settings, expenses || [], goals || [], bills), [settings, expenses, goals, bills]);

  const qaAllocIdEffective = qaAllocId || allocs.filter(a => a.recommended > 0)[0]?.id || "";

  const budgetWarnings = useMemo(() => {
    if (!settings || !expenses) return [];
    const spent = getSpentByAlloc(expenses);
    return allocs.filter(a => a.recommended > 0 && (spent[a.id] || 0) > a.recommended).map(a => ({
      name: a.name, icon: a.icon, spent: spent[a.id] || 0, budget: a.recommended, over: (spent[a.id] || 0) - a.recommended,
    }));
  }, [settings, expenses, allocs]);

  const d = calcDaysUntil(settings?.nextPayday);
  const now = new Date();
  const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12).getDate() - now.getDate();
  const sweepCycleKey = `${authUser?.id || "guest"}:${getSweepCycleKey(settings?.nextPayday)}`;
  const isSweepWindow = settings?.nextPayday ? (d !== null && d <= 3) : daysLeftInMonth <= 3;
  const hasAppliedSweepThisCycle = appliedSweepCycle === sweepCycleKey;
  const lastSweepRaw = (() => {
    try { return localStorage.getItem(`budget_last_sweep_payload:${authUser?.id || "guest"}`); } catch { return null; }
  })();
  const lastSweep = (() => {
    if (!lastSweepRaw) return null;
    try { return JSON.parse(lastSweepRaw) as { cycle: string; allocations: Array<{ key: string; label: string; amount: number }> }; } catch { return null; }
  })();
  const canUndoSweep = !!lastSweep && lastSweep.cycle === sweepCycleKey;

  const cycleEndReminders = useMemo(() => {
    if (!settings || !expenses || d === null || d > 5) return [];
    const spent = getSpentByAlloc(expenses);
    const reminders: { id: string; name: string; icon: string; needed: number }[] = [];
    allocs.forEach(a => {
      if (a.recommended > 0 && (a.id === "debt" || a.id === "savings" || a.id === "apartment")) {
        const spentAmt = spent[a.id] || 0;
        if (spentAmt < a.recommended * 0.5) {
          reminders.push({ id: a.id, name: a.name, icon: a.icon, needed: a.recommended - spentAmt });
        }
      }
    });
    return reminders;
  }, [settings, expenses, allocs, d]);

  if (loadingSettings || loadingExpenses || loadingBills) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const safe = getSafeToSpend(settings, bills);
  const dailySafe = getDailySafeSpend(settings, bills);
  const rollover = getEntertainmentUnused(settings, expenses || []) + Number(settings?.rolloverPool || 0);
  const pace = getMonthlyGoalPace(settings, expenses || [], bills);
  const recentSnapshots = [...(snapshots || [])].sort((a, b) => a.month.localeCompare(b.month)).slice(-4);
  const trendChartData = recentSnapshots.map((snap) => ({ month: snap.month.slice(5), spent: Number(snap.totalSpent || 0) }));
  const latestSnapshot = recentSnapshots[recentSnapshots.length - 1];
  const previousSnapshot = recentSnapshots[recentSnapshots.length - 2];
  const spendingTrendDelta = latestSnapshot && previousSnapshot ? Number(latestSnapshot.totalSpent || 0) - Number(previousSnapshot.totalSpent || 0) : null;

  const closeoutChecklist = [
    { label: "Bills reviewed", done: overdueBills.length === 0 },
    { label: "Smart sweep handled", done: smartSweep.sweepAmount <= 0 || hasAppliedSweepThisCycle },
    { label: "Expenses logged", done: (expenses || []).length > 0 },
  ];
  const closeoutReadyCount = closeoutChecklist.filter((item) => item.done).length;
  const closeoutWindowOpen = isSweepWindow;

  const accountTotals = useMemo(() => {
    const all = accounts || [];
    const liquid = all.filter(a => ["checking", "savings", "cash"].includes(String(a.type))).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const debt = all.filter(a => ["credit", "loan"].includes(String(a.type))).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const invested = all.filter(a => !["checking", "savings", "cash", "credit", "loan"].includes(String(a.type))).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const topAsset = [...all]
      .filter(a => !["credit", "loan"].includes(String(a.type)))
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0];
    const topDebt = [...all]
      .filter(a => ["credit", "loan"].includes(String(a.type)))
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0];
    return { liquid, debt, invested, topAsset, topDebt, count: all.length };
  }, [accounts]);

  const handleSaveMoney = () => {
    const payload: any = {};
    if (checkingInput) payload.checkingBalance = parseFloat(checkingInput).toFixed(2);
    if (paydayInput) payload.nextPayday = paydayInput;
    if (Object.keys(payload).length > 0) {
      updateSettings.mutate(payload, { onSuccess: () => setIsEditing(false) });
    } else {
      setIsEditing(false);
    }
  };

  const handleApplySmartSweep = () => {
    if (!settings || smartSweep.sweepAmount <= 0) return;
    if (!isSweepWindow) {
      toast({ title: "Sweep is locked for now", description: settings?.nextPayday ? "Smart sweep unlocks during the last 3 days before payday." : "Smart sweep unlocks during the last 3 days of the month." });
      return;
    }
    if (hasAppliedSweepThisCycle) {
      toast({ title: "Already swept this cycle", description: "You can only run smart sweep once per cycle. Use Undo if that was a mistake." });
      return;
    }
    const payload: any = {};
    smartSweep.allocations.forEach((entry) => {
      const current = Number((settings as any)?.[entry.key] || 0);
      payload[entry.key] = (current + entry.amount).toFixed(2);
    });
    updateSettings.mutate(payload, {
      onSuccess: () => {
        try {
          localStorage.setItem(`budget_last_sweep_cycle:${authUser?.id || "guest"}`, sweepCycleKey);
          localStorage.setItem(`budget_last_sweep_payload:${authUser?.id || "guest"}`, JSON.stringify({ cycle: sweepCycleKey, allocations: smartSweep.allocations }));
        } catch {}
        setAppliedSweepCycle(sweepCycleKey);
        toast({ title: "Smart sweep applied", description: `${formatMoney(smartSweep.sweepAmount)} was swept and this cycle is now locked.` });
      }
    });
  };

  const handleUndoSmartSweep = () => {
    if (!settings || !lastSweep || !canUndoSweep) return;
    const payload: any = {};
    lastSweep.allocations.forEach((entry) => {
      const current = Number((settings as any)?.[entry.key] || 0);
      payload[entry.key] = Math.max(0, current - Number(entry.amount || 0)).toFixed(2);
    });
    updateSettings.mutate(payload, {
      onSuccess: () => {
        try {
          localStorage.removeItem(`budget_last_sweep_cycle:${authUser?.id || "guest"}`);
          localStorage.removeItem(`budget_last_sweep_payload:${authUser?.id || "guest"}`);
        } catch {}
        setAppliedSweepCycle(null);
        toast({ title: "Last sweep undone", description: "The most recent smart sweep for this cycle was reversed." });
      }
    });
  };

  const startEditing = () => {
    setCheckingInput(settings?.checkingBalance?.toString() || "");
    setPaydayInput(settings?.nextPayday || "");
    setIsEditing(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {overdueBills.length > 0 && !dismissedBanner && (
        <div className="glass-panel p-4 border-destructive/40 bg-destructive/5 flex items-start gap-3 animate-in fade-in duration-300">
          <TriangleAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-bold text-destructive mb-2">
              {overdueBills.length} bill{overdueBills.length > 1 ? "s" : ""} due within 3 days
            </div>
            <div className="space-y-1.5">
              {overdueBills.map(bill => {
                const now = new Date();
                const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.dueDay, 12);
                const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
                const days = Math.ceil((dueDate.getTime() - todayNoon.getTime()) / 86400000);
                return (
                  <div key={bill.id} className="flex items-center justify-between text-xs text-foreground">
                    <span className="flex items-center gap-1.5"><span>{bill.icon}</span> {bill.name}</span>
                    <span className="font-mono font-semibold text-destructive">
                      {formatMoney(bill.amount)} · {days <= 0 ? "today" : `${days}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={() => setDismissedBanner(true)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {cycleEndReminders.length > 0 && !dismissedReminders && (
        <div className="glass-panel p-4 border-warning/30 bg-warning/5 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-warning mb-1">Payday in {d} day{d !== 1 ? "s" : ""} — allocations not yet logged</div>
              <p className="text-xs text-muted-foreground mb-2">You haven't logged spending for these important categories this cycle:</p>
              <div className="space-y-1">
                {cycleEndReminders.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs text-foreground">
                    <span className="flex items-center gap-1.5"><span>{r.icon}</span> {r.name}</span>
                    <span className="font-mono font-semibold text-warning">{formatMoney(r.needed)} recommended</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setDismissedReminders(true)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {budgetWarnings.length > 0 && !dismissedWarnings && (
        <div className="glass-panel p-4 border-destructive/30 bg-destructive/5 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-destructive mb-2">Over budget in {budgetWarnings.length} categor{budgetWarnings.length !== 1 ? "ies" : "y"}</div>
              <div className="space-y-1">
                {budgetWarnings.map(w => (
                  <div key={w.name} className="flex items-center justify-between text-xs text-foreground">
                    <span className="flex items-center gap-1.5"><span>{w.icon}</span> {w.name}</span>
                    <span className="font-mono font-semibold text-destructive">
                      {formatMoney(w.spent)} / {formatMoney(w.budget)} (+{formatMoney(w.over)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setDismissedWarnings(true)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {netWorth !== null && (
        <div className={`glass-panel p-6 border ${netWorth.total >= 0 ? 'border-success/20 bg-success/3' : 'border-destructive/20 bg-destructive/3'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Worth Snapshot</span>
          </div>
          <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className={`text-4xl font-bold font-mono ${netWorth.total >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatMoney(Math.abs(netWorth.total))}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {netWorth.total >= 0
                  ? <><TrendingUp className="w-3 h-3 text-success" /> Positive net worth</>
                  : <><TrendingDown className="w-3 h-3 text-destructive" /> Debt exceeds assets — keep going</>
                }
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">Checking balance</div>
              <div className="text-2xl font-bold font-mono text-foreground">{formatMoney(settings?.checkingBalance)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel-soft p-3">
              <div className="text-xs text-muted-foreground mb-1">Total assets</div>
              <div className="text-lg font-bold text-success font-mono">{formatMoney(netWorth.assets)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Checking + funds + pool</div>
            </div>
            <div className="glass-panel-soft p-3">
              <div className="text-xs text-muted-foreground mb-1">Total debt</div>
              <div className={`text-lg font-bold font-mono ${netWorth.debt > 0 ? 'text-destructive' : 'text-success'}`}>{netWorth.debt > 0 ? formatMoney(netWorth.debt) : "Debt free!"}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Remaining to pay off</div>
            </div>
          </div>
        </div>
      )}

      {surplusTracker && (
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">Month Summary</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Budgeted spending</span>
              <span className="font-mono font-semibold">{formatMoney(surplusTracker.budgeted)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Actual spending</span>
              <span className="font-mono font-semibold">{formatMoney(surplusTracker.actual)}</span>
            </div>
            <div className="pt-2 border-t border-border/30 flex justify-between items-center">
              <span className={`text-sm font-bold ${surplusTracker.surplus >= 0 ? "text-success" : "text-destructive"}`}>
                {surplusTracker.surplus >= 0 ? "Surplus" : "Deficit"}
              </span>
              <span className={`text-lg font-bold font-mono ${surplusTracker.surplus >= 0 ? "text-success" : "text-destructive"}`}>
                {surplusTracker.surplus >= 0 ? "+" : ""}{formatMoney(surplusTracker.surplus)}
              </span>
            </div>
          </div>
          {surplusTracker.topGoal && surplusTracker.surplus > 0 && (
            <div className="p-3 bg-success/8 border border-success/20 rounded-xl">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" /> Auto-redirect to goals
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{surplusTracker.topGoal.name}</span>
                <span className="text-xs font-mono font-bold text-success">+{formatMoney(surplusTracker.surplus)}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-success transition-all duration-500" style={{ width: `${Math.min(100, (Number((surplusTracker.topGoal as any).contributed || 0) / Number(surplusTracker.topGoal.cost)) * 100)}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 text-right">
                {formatMoney((surplusTracker.topGoal as any).contributed || 0)} / {formatMoney(surplusTracker.topGoal.cost)} funded
              </div>
            </div>
          )}
          {surplusTracker.surplus < 0 && (
            <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-xl text-xs text-muted-foreground">
              You've spent <span className="text-destructive font-semibold">{formatMoney(Math.abs(surplusTracker.surplus))} over</span> your budgeted amount this cycle. No surplus to redirect.
            </div>
          )}
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Accounts</span>
            </div>
            <span className={`text-sm font-bold font-mono ${accounts.reduce((s, a) => a.type === "credit" ? s - Number(a.balance) : s + Number(a.balance), 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {formatMoney(accounts.reduce((s, a) => a.type === "credit" ? s - Number(a.balance) : s + Number(a.balance), 0))} net
            </span>
          </div>
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{a.icon}</span>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
                <span className={`text-sm font-mono font-bold ${a.type === "credit" ? "text-destructive" : "text-foreground"}`}>
                  {a.type === "credit" ? "-" : ""}{formatMoney(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-primary">Money until next payday</h3>
            <p className="text-xs text-muted-foreground mt-1">This helps stop overspending late in the cycle</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            ⏳ Payday guard
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Next Payday</div>
            <div className="text-2xl font-bold text-primary mb-1 font-mono">
              {settings?.nextPayday
                ? new Date(settings.nextPayday + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Set date"}
            </div>
            <div className="text-xs text-muted-foreground">
              {d === null ? "Enter it below" : d <= 0 ? "Payday is today!" : `${d} day(s) left`}
            </div>
          </div>

          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Safe To Spend</div>
            <div className="text-2xl font-bold text-success mb-1 font-mono">{formatMoney(safe)}</div>
            <div className="text-xs text-muted-foreground">Protected after reserves</div>
          </div>

          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Daily Safe Spend</div>
            <div className="text-2xl font-bold text-warning mb-1 font-mono">{formatMoney(dailySafe)}</div>
            <div className="text-xs text-muted-foreground">Per day until payday</div>
          </div>
        </div>

        {payCycleData && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Pay cycle progress</span>
              <span className="font-mono">{payCycleData.elapsed} / {payCycleData.total} days used ({payCycleData.pct}%)</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden mb-3">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${payCycleData.pct >= 85 ? "bg-destructive" : payCycleData.pct >= 60 ? "bg-warning" : "bg-primary"}`}
                style={{ width: `${payCycleData.pct}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Spent this cycle </span>
                <span className="font-mono font-semibold text-foreground">{formatMoney(getSpentThisMonth(expenses || []))}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Daily burn </span>
                <span className={`font-mono font-semibold ${dailyBurnRate > dailySafe ? "text-destructive" : "text-success"}`}>{formatMoney(dailyBurnRate)}/day</span>
              </div>
              <div>
                <span className="text-muted-foreground">Target </span>
                <span className="font-mono font-semibold text-muted-foreground">{formatMoney(dailySafe)}/day</span>
              </div>
            </div>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4 pt-4 border-t border-border/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Current checking balance</label>
                <input
                  type="number" step="0.01"
                  value={checkingInput} onChange={e => setCheckingInput(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Next payday</label>
                <input
                  type="date"
                  value={paydayInput} onChange={e => setPaydayInput(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveMoney} disabled={updateSettings.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                {updateSettings.isPending ? "Saving..." : "Save Tracker"}
              </button>
              <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-card-soft text-foreground font-semibold rounded-xl hover:bg-white/5 transition-colors border border-border">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-border/30">
            <button onClick={startEditing} className="px-6 py-2.5 bg-card-soft text-foreground font-semibold rounded-xl hover:bg-white/5 transition-colors border border-border shadow-sm text-sm">
              Edit Balance & Payday
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold text-foreground">Monthly Command Center</h3>
            <p className="text-xs text-muted-foreground mt-1">Cleaner layout with your most important numbers first</p>
          </div>
          <div className="px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold">
            Savings rate {savingsRate.toFixed(0)}%
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="glass-panel-soft p-4"><div className="text-xs text-muted-foreground mb-1">Monthly income</div><div className="text-2xl font-bold font-mono text-foreground">{formatMoney(Number(settings?.paycheck || 0) * 2)}</div></div>
          <div className="glass-panel-soft p-4"><div className="text-xs text-muted-foreground mb-1">Spent this month</div><div className="text-2xl font-bold font-mono text-destructive">{formatMoney(getSpentThisMonth(expenses || []))}</div></div>
          <div className="glass-panel-soft p-4"><div className="text-xs text-muted-foreground mb-1">Net worth</div><div className={`text-2xl font-bold font-mono ${netWorthSummary.netWorth >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(netWorthSummary.netWorth)}</div></div>
          <div className="glass-panel-soft p-4"><div className="text-xs text-muted-foreground mb-1">Smart sweep potential</div><div className="text-2xl font-bold font-mono text-primary">{formatMoney(smartSweep.sweepAmount)}</div></div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-panel-soft p-4">
            <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold text-foreground">Budget vs actual</div><div className="text-[11px] text-muted-foreground">Top categories</div></div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData.slice(0, 6)} barCategoryGap={12}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(value: number | string) => formatMoney(Number(value))} />
                  <Bar dataKey="budget" radius={[6, 6, 0, 0]} fill="hsl(var(--primary) / 0.35)" />
                  <Bar dataKey="actual" radius={[6, 6, 0, 0]} fill="hsl(var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-panel-soft p-4">
            <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold text-foreground">Spending mix</div><div className="text-[11px] text-muted-foreground">Where the month went</div></div>
            <div className="h-64">
              {spendingMix.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spendingMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                      {spendingMix.map((entry, index) => (
                        <Cell key={entry.name} fill={["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))"][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string) => formatMoney(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Log expenses to see your mix chart.</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {spendingMix.slice(0, 4).map((item) => (
                <div key={item.name} className="text-xs text-muted-foreground flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-2">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className="font-mono text-foreground">{formatMoney(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Smart Leftover Optimizer</h3>
              <p className="text-xs text-muted-foreground mt-1">Runs once per cycle near payday, then locks until the next one</p>
            </div>
            <div className="text-right"><div className="text-xs text-muted-foreground">Sweep amount</div><div className="text-xl font-bold font-mono text-primary">{formatMoney(smartSweep.sweepAmount)}</div></div>
          </div>
          <div className={`mb-4 rounded-xl border px-3 py-3 text-xs ${isSweepWindow ? "border-success/25 bg-success/5 text-success" : "border-warning/25 bg-warning/5 text-warning"}`}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              {isSweepWindow ? <CalendarClock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {isSweepWindow ? "Sweep window is open" : "Sweep window is closed"}
            </div>
            <div className="text-muted-foreground">
              {settings?.nextPayday
                ? (isSweepWindow ? `You can sweep now. Next payday is ${settings.nextPayday}.` : `Smart sweep unlocks during the last 3 days before your next payday.`)
                : (isSweepWindow ? "You can sweep now because the month is closing out." : "Smart sweep unlocks during the last 3 days of the month.")}
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {smartSweep.allocations.length > 0 ? smartSweep.allocations.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <span className="text-sm text-foreground">{entry.label}</span>
                <span className="text-sm font-bold font-mono text-success">{formatMoney(entry.amount)}</span>
              </div>
            )) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-muted-foreground">No sweep available yet. Leave money unspent or create more breathing room in your plan.</div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={handleApplySmartSweep} disabled={smartSweep.sweepAmount <= 0 || updateSettings.isPending || !isSweepWindow || hasAppliedSweepThisCycle} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {updateSettings.isPending ? "Applying..." : hasAppliedSweepThisCycle ? "Already swept this cycle" : "Apply smart sweep"}
            </button>
            <button onClick={handleUndoSmartSweep} disabled={!canUndoSweep || updateSettings.isPending} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-50 flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Undo last sweep
            </button>
          </div>
        </div>
        <div className="glass-panel p-6">
          <div className="mb-4"><h3 className="text-sm font-bold text-foreground">Monthly insights</h3><p className="text-xs text-muted-foreground mt-1">Quick advisor-style takeaways from your numbers</p></div>
          <div className="space-y-2 mb-4">
            {insights.map((insight, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">{insight}</div>
            ))}
          </div>
          <div className="rounded-xl border border-success/20 bg-success/5 p-4">
            <div className="text-xs font-semibold text-success mb-2">Goal forecast</div>
            <div className="space-y-3">
              {goalForecast.length > 0 ? goalForecast.map((goal) => (
                <div key={goal.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs mb-1"><span className="font-medium text-foreground">{goal.name}</span><span className="text-muted-foreground">{goal.monthsLeft === null ? "No pace yet" : `${goal.monthsLeft} mo left`}</span></div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2"><div className="h-2 rounded-full bg-success" style={{ width: `${goal.progress}%` }} /></div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>Need per month <span className="font-mono text-foreground">{formatMoney(goal.recommendedMonthly)}</span></div>
                    <div className="text-right">{goal.targetDate ? `Target ${goal.targetDate}` : (goal.isAhead ? "Pace looks good" : "Add more monthly money")}</div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">Add goals to forecast how fast you can hit them.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-panel p-6 xl:col-span-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Monthly closeout</h3>
              <p className="text-xs text-muted-foreground mt-1">Review, sweep, save the month, then reset cleanly for the next cycle</p>
            </div>
            <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${closeoutWindowOpen ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}`}>
              {closeoutWindowOpen ? "Window open" : "Too early"}
            </div>
          </div>
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Closeout checklist</span>
              <span className="text-sm font-bold text-foreground">{closeoutReadyCount}/3</span>
            </div>
            <div className="space-y-2">
              {closeoutChecklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <span className={item.done ? "text-success font-semibold" : "text-muted-foreground"}>{item.done ? "Done" : "Pending"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Snapshot month</span><span className="font-mono text-foreground">{currentMonthKey}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Expenses to archive</span><span className="font-mono text-foreground">{formatMoney(getSpentThisMonth(expenses || []))}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Current sweep plan</span><span className="font-mono text-primary">{formatMoney(smartSweep.sweepAmount)}</span></div>
          </div>
          {!showCloseoutConfirm ? (
            <button onClick={() => setShowCloseoutConfirm(true)} disabled={!closeoutWindowOpen || resetExpenses.isPending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {closeoutWindowOpen ? "Start monthly closeout" : "Closeout opens near cycle end"}
            </button>
          ) : (
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">This will save a monthly snapshot and clear this cycle's logged expenses.</div>
              <div className="text-xs text-muted-foreground">Bills stay in place. Autopay bills get marked for the new month again. This is the clean reset button for the next cycle.</div>
              <div className="flex gap-2">
                <button
                  onClick={() => resetExpenses.mutate(undefined, {
                    onSuccess: () => {
                      setShowCloseoutConfirm(false);
                      toast({ title: "Month closed out", description: `Saved ${currentMonthKey} and started a clean cycle.` });
                    }
                  })}
                  disabled={resetExpenses.isPending}
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {resetExpenses.isPending ? "Closing out..." : "Confirm closeout"}
                </button>
                <button onClick={() => setShowCloseoutConfirm(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-foreground">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-6 xl:col-span-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Monthly report card</h3>
              <p className="text-xs text-muted-foreground mt-1">A cleaner end-of-month style summary for the way you budget</p>
            </div>
            <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${monthlyReport.leftover >= 0 ? "border-success/20 bg-success/10 text-success" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
              {monthlyReport.leftover >= 0 ? "On track" : "Needs tightening"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Income</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(monthlyReport.income)}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Spent</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(monthlyReport.spent)}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Fixed bills</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(monthlyReport.fixed)}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Saved so far</div><div className="text-lg font-bold font-mono text-success">{formatMoney(monthlyReport.savings)}</div></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Savings rate</span>
              <span className="text-sm font-bold text-primary">{monthlyReport.savingsRate.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.min(100, monthlyReport.savingsRate)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">{monthlyReport.status}</div>
        </div>

        <div className="glass-panel p-6 xl:col-span-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Debt payoff section</h3>
              <p className="text-xs text-muted-foreground mt-1">Shows how fast your debt can disappear at your current pace</p>
            </div>
            <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${debtSummary.debtRemaining <= 0 ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}`}>
              {debtSummary.debtRemaining <= 0 ? "Debt free" : debtSummary.monthsLeft === null ? "Set a debt target" : `${debtSummary.monthsLeft} mo est.`}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Remaining debt</div><div className="text-lg font-bold font-mono text-destructive">{formatMoney(debtSummary.debtRemaining)}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Monthly debt power</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(debtSummary.monthlyPower)}</div></div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
              <span>Debt progress</span>
              <span>{debtSummary.progress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-2.5 rounded-full bg-warning" style={{ width: `${Math.min(100, debtSummary.progress)}%` }} />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Planned debt budget</span><span className="font-mono text-foreground">{formatMoney(debtSummary.monthlyContribution)}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Possible sweep boost</span><span className="font-mono text-primary">{formatMoney(debtSummary.sweepBoost)}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Net worth breakdown</h3>
              <p className="text-xs text-muted-foreground mt-1">A cleaner assets vs debt view so you can understand your money at a glance</p>
            </div>
            <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${netWorthSummary.netWorth >= 0 ? "border-success/20 bg-success/10 text-success" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
              {formatMoney(netWorthSummary.netWorth)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Liquid</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(accountTotals.liquid || netWorthSummary.assets)}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Debt</div><div className="text-lg font-bold font-mono text-destructive">{formatMoney(Math.max(accountTotals.debt, netWorthSummary.liabilities))}</div></div>
            <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Tracked</div><div className="text-lg font-bold font-mono text-foreground">{accountTotals.count}</div></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
            <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground"><span>Net worth progress</span><span>{netWorthSummary.netWorth >= 0 ? "positive" : "negative"}</span></div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-2"><div className="h-2.5 rounded-full bg-success" style={{ width: `${Math.min(100, netWorthSummary.assets <= 0 ? 0 : (netWorthSummary.assets / Math.max(netWorthSummary.assets + netWorthSummary.liabilities, 1)) * 100)}%` }} /></div>
                <div className="text-[11px] text-muted-foreground">Assets {formatMoney(netWorthSummary.assets)}</div>
              </div>
              <div className="text-xs text-muted-foreground">vs</div>
              <div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-2"><div className="h-2.5 rounded-full bg-destructive" style={{ width: `${Math.min(100, netWorthSummary.liabilities <= 0 ? 0 : (netWorthSummary.liabilities / Math.max(netWorthSummary.assets + netWorthSummary.liabilities, 1)) * 100)}%` }} /></div>
                <div className="text-[11px] text-muted-foreground text-right">Liabilities {formatMoney(netWorthSummary.liabilities)}</div>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Top asset</span><span className="font-mono text-foreground">{accountTotals.topAsset ? `${accountTotals.topAsset.name} · ${formatMoney(accountTotals.topAsset.balance)}` : "Add an account"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"><span className="text-muted-foreground">Top debt</span><span className="font-mono text-foreground">{accountTotals.topDebt ? `${accountTotals.topDebt.name} · ${formatMoney(accountTotals.topDebt.balance)}` : "No tracked debt account"}</span></div>
          </div>
        </div>

      <div className="glass-panel p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Trend report</h3>
            <p className="text-xs text-muted-foreground mt-1">How your last saved months compare</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${spendingTrendDelta === null ? "border-white/10 text-muted-foreground" : spendingTrendDelta <= 0 ? "border-success/20 bg-success/10 text-success" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
            {spendingTrendDelta === null ? "Need 2 months" : spendingTrendDelta <= 0 ? `${formatMoney(Math.abs(spendingTrendDelta))} lower` : `${formatMoney(spendingTrendDelta)} higher`}
          </div>
        </div>
        {trendChartData.length > 0 ? (
          <>
            <div className="h-56 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} />
                  <Tooltip formatter={(value: number | string) => formatMoney(Number(value))} />
                  <Bar dataKey="spent" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Last saved month</div><div className="text-lg font-bold font-mono text-foreground">{latestSnapshot?.month || "—"}</div></div>
              <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Spent that month</div><div className="text-lg font-bold font-mono text-foreground">{latestSnapshot ? formatMoney(latestSnapshot.totalSpent) : "—"}</div></div>
              <div className="glass-panel-soft p-3"><div className="text-xs text-muted-foreground mb-1">Compared to prior</div><div className={`text-lg font-bold font-mono ${spendingTrendDelta === null ? "text-muted-foreground" : spendingTrendDelta <= 0 ? "text-success" : "text-destructive"}`}>{spendingTrendDelta === null ? "—" : `${spendingTrendDelta <= 0 ? "-" : "+"}${formatMoney(Math.abs(spendingTrendDelta))}`}</div></div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-muted-foreground">Reset a cycle to save snapshots, then your trend report will start filling in here.</div>
        )}
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <div className="text-xs text-muted-foreground mb-1">Rollover money</div>
          <div className="text-3xl font-bold text-foreground mb-1 font-mono">{formatMoney(rollover)}</div>
          <div className="text-xs text-muted-foreground mb-4">Unused fun money + rollover pool</div>
          <p className="text-xs text-primary/80 bg-primary/10 p-3 rounded-lg border border-primary/20 leading-relaxed">
            This is money you didn't burn on random stuff. Move it into future goals.
          </p>
        </div>
        <div className="glass-panel p-6">
          <div className="text-xs text-muted-foreground mb-1">Monthly goal pace</div>
          <div className="text-3xl font-bold text-success mb-1 font-mono">{formatMoney(pace)}</div>
          <div className="text-xs text-muted-foreground mb-4">Estimated monthly power for future goals</div>
          <p className="text-xs text-success/80 bg-success/10 p-3 rounded-lg border border-success/20 leading-relaxed">
            This uses your leftover, unused fun money, and a small cushion.
          </p>
        </div>
      </div>

      <div className="glass-panel p-5">
        <button
          onClick={() => setShowQuickAdd(v => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary-foreground" />
            </div>
            Quick log an expense
          </div>
          <span className="text-xs text-muted-foreground">{showQuickAdd ? "Close" : "Tap to open"}</span>
        </button>
        {showQuickAdd && (
          <form
            className="mt-4 space-y-3"
            onSubmit={e => {
              e.preventDefault();
              const num = parseFloat(qaAmount);
              if (!qaName.trim() || isNaN(num) || num <= 0) return;
              createExpense.mutate({
                name: qaName.trim(),
                amount: num.toFixed(2),
                allocId: qaAllocIdEffective,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              }, {
                onSuccess: () => { setQaName(""); setQaAmount(""); setShowQuickAdd(false); }
              });
            }}
          >
            <input
              type="text" value={qaName} onChange={e => setQaName(e.target.value)} required
              placeholder="What did you spend on?"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                <input
                  type="number" step="0.01" value={qaAmount} onChange={e => setQaAmount(e.target.value)} required
                  placeholder="0.00"
                  className="w-full bg-background border border-border rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <select
                value={qaAllocIdEffective} onChange={e => setQaAllocId(e.target.value)}
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-all appearance-none"
              >
                {allocs.filter(a => a.recommended > 0).map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit" disabled={createExpense.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {createExpense.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createExpense.isPending ? "Logging..." : "Log Expense"}
            </button>
          </form>
        )}
      </div>

      <div className="glass-panel p-6">
        <div className="mb-5">
          <h3 className="text-sm font-bold text-foreground">Quick reality check</h3>
          <p className="text-xs text-muted-foreground mt-1">A simple view of where your money stands</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel-soft p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Reserved Money</div>
              <div className="text-xs text-muted-foreground max-w-[150px]">Buffer + due soon bills + emergency floor</div>
            </div>
            <div className="text-xl font-bold text-foreground font-mono">{formatMoney(getReservedMoney(settings, bills))}</div>
          </div>
          <div className="glass-panel-soft p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Spent Logged</div>
              <div className="text-xs text-muted-foreground">Expenses logged this cycle</div>
            </div>
            <div className="text-xl font-bold text-foreground font-mono">{formatMoney(getSpentThisMonth(expenses || []))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
