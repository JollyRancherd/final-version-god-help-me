import { type Settings, type Expense, type UnlockedGoal, type RecurringBill } from "@shared/schema";
import { TOTAL_DEBT, BUFFER, PHASE1_ALLOCS, PHASE2_ALLOCS, DEFAULT_FIXED_BILLS } from "./constants";

export const formatMoney = (n: number | string | undefined | null): string => {
  const num = Number(n || 0);
  return (num < 0 ? "-$" : "$") + Math.abs(num).toFixed(2);
};

export const getAllocs = (phase: number, overridesJson?: string | null, namesJson?: string | null) => {
  const base = (phase === 1 ? PHASE1_ALLOCS : PHASE2_ALLOCS).map(a => ({ ...a }));
  let result = base;
  if (overridesJson) {
    try {
      const overrides = JSON.parse(overridesJson);
      result = result.map(a => overrides[a.id] !== undefined ? { ...a, recommended: Number(overrides[a.id]) } : a);
    } catch {}
  }
  if (namesJson) {
    try {
      const names = JSON.parse(namesJson);
      result = result.map(a => names[a.id] ? { ...a, name: String(names[a.id]) } : a);
    } catch {}
  }
  return result;
};

export const normalizeBills = (bills?: RecurringBill[] | null) => {
  if (bills && bills.length > 0) return bills.filter(b => b.active !== false);
  return DEFAULT_FIXED_BILLS.map((bill, index) => ({
    id: index + 1,
    ...bill,
    amount: bill.amount.toFixed(2),
    active: true,
  })) as unknown as RecurringBill[];
};

export const getTotalFixed = (bills?: RecurringBill[] | null) => {
  return normalizeBills(bills).reduce((s, b) => s + Number(b.amount), 0);
};

export const getMonthlyIncome = (settings: Settings | null | undefined) => Number(settings?.paycheck || 0) * 2;
export const getTotalAllocs = (phase: number) => getAllocs(phase).reduce((s, a) => s + a.recommended, 0);

export const getLeftover = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  if (!settings) return 0;
  return getMonthlyIncome(settings) - BUFFER - getTotalFixed(bills) - getTotalAllocs(settings.phase);
};

export const getSpentByAlloc = (expenses: Expense[]) => {
  const out: Record<string, number> = {};
  expenses.forEach(e => { out[e.allocId] = (out[e.allocId] || 0) + Number(e.amount); });
  return out;
};

export const getSpentThisMonth = (expenses: Expense[]) => expenses.reduce((s, e) => s + Number(e.amount), 0);
export const getDebtRemaining = (settings: Settings | null | undefined) => {
  const totalDebt = Number((settings as any)?.totalDebt ?? 0);
  const debtPaid = Number(settings?.debtPaid || 0);
  // totalDebt > 0 → user set their real debt total
  // totalDebt == 0 and debtPaid == 0 → user said debt-free in onboarding
  // totalDebt == 0 and debtPaid > 0 → legacy user using hardcoded constant
  const total = totalDebt > 0 ? totalDebt : (debtPaid > 0 ? TOTAL_DEBT : 0);
  return Math.max(0, total - debtPaid);
};

export const calcDaysUntil = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr + "T12:00:00");
  const ms = target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  return Math.ceil(ms / 86400000);
};

export const getBillDueDate = (day: number): Date => {
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), day, 12);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (due < todayNoon) due = new Date(now.getFullYear(), now.getMonth() + 1, day, 12);
  return due;
};

export const nextDueDays = (day: number): number => {
  const due = getBillDueDate(day);
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.ceil((due.getTime() - todayNoon.getTime()) / 86400000);
};

export const getUpcomingBills = (bills?: RecurringBill[] | null, windowDays = 14) => {
  return normalizeBills(bills)
    .map((bill) => ({ bill, dueDate: getBillDueDate(bill.dueDay), daysUntil: nextDueDays(bill.dueDay) }))
    .filter((item) => item.daysUntil <= windowDays)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
};

export const getReservedMoney = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  const dueSoon = normalizeBills(bills)
    .filter(b => nextDueDays(b.dueDay) <= 14)
    .reduce((s, b) => s + Number(b.amount), 0);
  const emergencyFloor = Math.min(Number(settings?.emergencyFund || 0), 300);
  return BUFFER + dueSoon + emergencyFloor;
};

export const getSafeToSpend = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  if (!settings) return 0;
  return Math.max(0, Number(settings.checkingBalance || 0) - getReservedMoney(settings, bills));
};

export const getDailySafeSpend = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  if (!settings) return 0;
  const d = calcDaysUntil(settings.nextPayday);
  const safe = getSafeToSpend(settings, bills);
  if (d === null || d <= 0) return safe;
  return safe / d;
};

export const getEntertainmentUnused = (settings: Settings | null | undefined, expenses: Expense[]) => {
  if (!settings) return 0;
  const budget = getAllocs(settings.phase).find(x => x.id === "entertainment")?.recommended ?? 0;
  const spent = getSpentByAlloc(expenses)["entertainment"] || 0;
  return Math.max(0, budget - spent);
};

export const getProjectedGoalMoney = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  if (!settings) return 0;
  return Number(settings.rolloverPool || 0) + Number(settings.savingsFund || 0) + Math.max(0, getLeftover(settings, bills)) + Number(settings.apartmentFund || 0);
};

export const getAffordability = (goal: UnlockedGoal, settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  if (!settings) return { money: 0, diff: -Number(goal.cost), level: "red" };
  const protectedMoney = getProjectedGoalMoney(settings, bills);
  const safeCash = getSafeToSpend(settings, bills);
  const money = goal.useProtected ? protectedMoney + safeCash : protectedMoney;
  const diff = money - Number(goal.cost || 0);

  let level = "red";
  if (diff >= 0) level = "green";
  else if (diff >= -(Number(goal.cost) * 0.15)) level = "yellow";

  return { money, diff, level };
};

export const getMonthlyGoalPace = (settings: Settings | null | undefined, expenses: Expense[], bills?: RecurringBill[] | null) => {
  return Math.max(0, getLeftover(settings, bills)) + getEntertainmentUnused(settings, expenses) + 50;
};

export const getMonthsUntil = (cost: number, settings: Settings | null | undefined, expenses: Expense[], bills?: RecurringBill[] | null): number | null => {
  const pace = getMonthlyGoalPace(settings, expenses, bills);
  if (pace <= 0) return null;
  return Math.ceil(Math.max(0, cost - getProjectedGoalMoney(settings, bills)) / pace);
};

export const calcDeadlinePlanning = (
  cost: number,
  contributed: number,
  targetDateStr: string,
  monthlyPace: number
): { monthsLeft: number; required: number; isAhead: boolean; deficit: number } | null => {
  const target = new Date(targetDateStr + "T12:00:00");
  const now = new Date();
  const monthsLeft = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  if (monthsLeft <= 0) return null;
  const remaining = Math.max(0, cost - contributed);
  if (remaining <= 0) return { monthsLeft, required: 0, isAhead: true, deficit: 0 };
  const required = remaining / monthsLeft;
  return { monthsLeft, required, isAhead: monthlyPace >= required, deficit: Math.max(0, required - monthlyPace) };
};

export const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export const getStatusData = (settings: Settings | null | undefined, bills?: RecurringBill[] | null) => {
  const left = getLeftover(settings, bills);
  if (left < 0) return { text: "Over Budget", color: "text-destructive", bg: "bg-destructive/15 border-destructive/30" };
  if (left < 50) return { text: "Nearly Full", color: "text-warning", bg: "bg-warning/15 border-warning/30" };
  return { text: "On Track ✓", color: "text-success", bg: "bg-success/15 border-success/30" };
};


export const getNetWorthBreakdown = (
  settings: Settings | null | undefined,
  accounts?: Array<{ type: string; balance: number | string }> | null
) => {
  const tracked = (accounts || []).reduce((acc, account) => {
    const balance = Number(account.balance || 0);
    if (account.type === "credit" || account.type === "loan") {
      acc.liabilities += balance;
    } else {
      acc.assets += balance;
    }
    return acc;
  }, { assets: 0, liabilities: 0 });

  const fallbackAssets =
    Number(settings?.checkingBalance || 0) +
    Number(settings?.emergencyFund || 0) +
    Number(settings?.apartmentFund || 0) +
    Number(settings?.savingsFund || 0) +
    Number(settings?.rolloverPool || 0);

  const debtRemaining = getDebtRemaining(settings);
  const assets = tracked.assets > 0 ? tracked.assets : fallbackAssets;
  const liabilities = Math.max(tracked.liabilities, debtRemaining);

  return { assets, liabilities, netWorth: assets - liabilities };
};

export const getSavingsRate = (settings: Settings | null | undefined, expenses: Expense[]) => {
  const income = getMonthlyIncome(settings);
  if (income <= 0) return 0;
  const saved = Math.max(0, income - getSpentThisMonth(expenses));
  return (saved / income) * 100;
};

export const getBudgetVsActualData = (settings: Settings | null | undefined, expenses: Expense[]) => {
  if (!settings) return [];
  const spent = getSpentByAlloc(expenses);
  return getAllocs(settings.phase, (settings as any)?.allocOverrides, (settings as any)?.allocNames)
    .filter((alloc) => alloc.recommended > 0)
    .map((alloc) => ({
      id: alloc.id,
      name: alloc.name,
      icon: alloc.icon,
      budget: alloc.recommended,
      actual: spent[alloc.id] || 0,
      remaining: Math.max(0, alloc.recommended - (spent[alloc.id] || 0)),
      delta: (spent[alloc.id] || 0) - alloc.recommended,
    }))
    .sort((a, b) => b.budget - a.budget);
};

export const getSpendingMixData = (settings: Settings | null | undefined, expenses: Expense[]) => {
  if (!settings) return [];
  return getBudgetVsActualData(settings, expenses)
    .filter((item) => item.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 6)
    .map((item) => ({ name: item.name, value: item.actual, label: `${item.icon} ${item.name}` }));
};

export const getTopSpendingInsights = (
  settings: Settings | null | undefined,
  expenses: Expense[],
  bills?: RecurringBill[] | null,
) => {
  if (!settings) return [];
  const budgetRows = getBudgetVsActualData(settings, expenses);
  const overspent = budgetRows.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2);
  const leftover = getLeftover(settings, bills);
  const savingsRate = getSavingsRate(settings, expenses);
  const topSpend = [...budgetRows].sort((a, b) => b.actual - a.actual)[0];
  const insights: string[] = [];
  if (topSpend && topSpend.actual > 0) insights.push(`${topSpend.name} is your biggest spend at ${formatMoney(topSpend.actual)} this month.`);
  overspent.forEach((row) => insights.push(`You are ${formatMoney(row.delta)} over the ${row.name} plan.`));
  if (leftover > 0) insights.push(`Your current monthly surplus is ${formatMoney(leftover)} after bills, buffer, and allocation targets.`);
  else if (leftover < 0) insights.push(`Your plan is short by ${formatMoney(Math.abs(leftover))}. Tighten spending or lower targets.`);
  insights.push(`Savings rate is ${savingsRate.toFixed(0)}% based on your current monthly income.`);
  return insights.slice(0, 4);
};

export const getGoalForecast = (
  goals: UnlockedGoal[],
  settings: Settings | null | undefined,
  expenses: Expense[],
  bills?: RecurringBill[] | null,
) => {
  const monthlyPace = getMonthlyGoalPace(settings, expenses, bills);
  return goals
    .filter((goal) => !(goal as any).locked)
    .map((goal) => {
      const cost = Number(goal.cost || 0);
      const contributed = Number((goal as any).contributed || 0);
      const remaining = Math.max(0, cost - contributed);
      const monthsLeft = monthlyPace > 0 ? Math.ceil(remaining / monthlyPace) : null;
      return {
        id: goal.id,
        name: goal.name,
        cost,
        contributed,
        remaining,
        progress: cost > 0 ? Math.min(100, (contributed / cost) * 100) : 0,
        monthsLeft,
      };
    })
    .sort((a, b) => a.remaining - b.remaining);
};

export const buildSmartSweepPlan = (
  settings: Settings | null | undefined,
  expenses: Expense[],
  goals: UnlockedGoal[],
  bills?: RecurringBill[] | null,
) => {
  if (!settings) return { sweepAmount: 0, allocations: [] as Array<{ key: string; label: string; amount: number }> };
  const budgetRows = getBudgetVsActualData(settings, expenses);
  const categorySurplus = budgetRows.reduce((sum, row) => sum + Math.max(0, row.remaining), 0);
  const monthlyLeftover = Math.max(0, getLeftover(settings, bills));
  const positiveCandidates = [monthlyLeftover, categorySurplus].filter((value) => value > 0);
  const sweepAmount = positiveCandidates.length === 0
    ? 0
    : positiveCandidates.length === 1
      ? positiveCandidates[0]
      : Math.min(...positiveCandidates);
  if (sweepAmount <= 0) return { sweepAmount: 0, allocations: [] as Array<{ key: string; label: string; amount: number }> };
  const debtRemaining = getDebtRemaining(settings);
  const emergencyGap = Math.max(0, Number(settings.emergencyGoal || 0) - Number(settings.emergencyFund || 0));
  const topGoal = [...goals]
    .filter((goal) => !(goal as any).locked && Number((goal as any).contributed || 0) < Number(goal.cost || 0))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))[0];
  const weights = debtRemaining > 0
    ? [
        { key: 'debtPaid', label: 'Debt payoff', weight: 0.5 },
        { key: 'emergencyFund', label: 'Emergency fund', weight: emergencyGap > 0 ? 0.3 : 0.2 },
        { key: 'rolloverPool', label: topGoal ? topGoal.name : 'Goals pool', weight: 0.2 },
      ]
    : [
        { key: 'emergencyFund', label: 'Emergency fund', weight: emergencyGap > 0 ? 0.4 : 0.2 },
        { key: 'savingsFund', label: 'Savings fund', weight: 0.35 },
        { key: 'rolloverPool', label: topGoal ? topGoal.name : 'Goals pool', weight: 0.25 },
      ];
  let allocatedSoFar = 0;
  const allocations = weights.map((entry, index) => {
    const isLast = index === weights.length - 1;
    const amount = isLast ? Math.max(0, sweepAmount - allocatedSoFar) : Math.round(sweepAmount * entry.weight * 100) / 100;
    allocatedSoFar += amount;
    return { key: entry.key, label: entry.label, amount };
  });
  return { sweepAmount, allocations };
};


export const getMonthlyReportCard = (
  settings: Settings | null | undefined,
  expenses: Expense[],
  bills?: RecurringBill[] | null,
) => {
  const income = getMonthlyIncome(settings);
  const spent = getSpentThisMonth(expenses);
  const fixed = getTotalFixed(bills);
  const reserved = getReservedMoney(settings, bills);
  const savings = Math.max(0, income - spent);
  const leftover = getLeftover(settings, bills);
  const status = leftover >= 0
    ? `You are running ${formatMoney(leftover)} above target this month.`
    : `You are running ${formatMoney(Math.abs(leftover))} behind target this month.`;
  return {
    income,
    spent,
    fixed,
    reserved,
    savings,
    leftover,
    savingsRate: income > 0 ? (savings / income) * 100 : 0,
    status,
  };
};

export const getGoalForecastDetails = (
  goals: UnlockedGoal[],
  settings: Settings | null | undefined,
  expenses: Expense[],
  bills?: RecurringBill[] | null,
) => {
  const monthlyPace = getMonthlyGoalPace(settings, expenses, bills);
  return goals
    .filter((goal) => !(goal as any).locked)
    .map((goal) => {
      const cost = Number(goal.cost || 0);
      const contributed = Number((goal as any).contributed || 0);
      const remaining = Math.max(0, cost - contributed);
      const monthsLeft = monthlyPace > 0 ? Math.ceil(remaining / monthlyPace) : null;
      const targetPlan = goal.targetDate
        ? calcDeadlinePlanning(cost, contributed, goal.targetDate, monthlyPace)
        : null;
      return {
        id: goal.id,
        name: goal.name,
        cost,
        contributed,
        remaining,
        progress: cost > 0 ? Math.min(100, (contributed / cost) * 100) : 0,
        monthsLeft,
        monthlyPace,
        recommendedMonthly: targetPlan ? Math.ceil(targetPlan.required * 100) / 100 : Math.ceil((remaining / Math.max(1, monthsLeft || 1)) * 100) / 100,
        targetDate: goal.targetDate || null,
        isAhead: targetPlan ? targetPlan.isAhead : monthlyPace > 0,
      };
    })
    .sort((a, b) => {
      const ap = a.monthsLeft === null ? Number.POSITIVE_INFINITY : a.monthsLeft;
      const bp = b.monthsLeft === null ? Number.POSITIVE_INFINITY : b.monthsLeft;
      return ap - bp || a.remaining - b.remaining;
    });
};

export const getDebtPayoffSummary = (
  settings: Settings | null | undefined,
  expenses: Expense[],
  bills?: RecurringBill[] | null,
) => {
  const debtRemaining = getDebtRemaining(settings);
  const debtBudget = settings ? (getAllocs(settings.phase, (settings as any)?.allocOverrides, (settings as any)?.allocNames).find((a) => a.id === 'debt')?.recommended || 0) : 0;
  const debtSpent = getSpentByAlloc(expenses)['debt'] || 0;
  const monthlyContribution = Math.max(debtBudget, debtSpent, debtBudget > 0 ? debtBudget : 0);
  const sweepBoost = debtRemaining > 0 ? Math.max(0, getLeftover(settings, bills)) * 0.5 : 0;
  const monthlyPower = monthlyContribution + sweepBoost;
  return {
    debtRemaining,
    monthlyContribution,
    sweepBoost,
    monthlyPower,
    monthsLeft: monthlyPower > 0 ? Math.ceil(debtRemaining / monthlyPower) : null,
    progress: Number((settings as any)?.totalDebt || 0) > 0
      ? Math.min(100, (Number(settings?.debtPaid || 0) / Number((settings as any)?.totalDebt || 0)) * 100)
      : (debtRemaining <= 0 ? 100 : 0),
  };
};

export const buildPaycheckBudgetPlan = (
  settings: Settings | null | undefined,
  grossPay: number,
  netPay: number,
  bills?: RecurringBill[] | null,
) => {
  const withheld = Math.max(0, grossPay - netPay);
  const upcomingBills = getUpcomingBills(bills, 14);
  const dueSoonTotal = upcomingBills.reduce((sum, item) => sum + Number(item.bill.amount || 0), 0);
  const emergencyGap = Math.max(0, Number(settings?.emergencyGoal || 0) - Number(settings?.emergencyFund || 0));
  const debtRemaining = getDebtRemaining(settings);

  let remaining = Math.max(0, netPay);
  const plan: Array<{ key: string; label: string; amount: number; note: string }> = [];

  const reserveBills = Math.min(remaining, dueSoonTotal);
  if (reserveBills > 0) {
    plan.push({ key: 'bills', label: 'Bills reserve', amount: reserveBills, note: `${upcomingBills.length} bill${upcomingBills.length === 1 ? '' : 's'} due soon` });
    remaining -= reserveBills;
  }

  const essentialsTarget = Math.min(remaining, netPay * 0.4);
  if (essentialsTarget > 0) {
    plan.push({ key: 'essentials', label: 'Everyday spending', amount: essentialsTarget, note: 'Gas, groceries, and normal spending room' });
    remaining -= essentialsTarget;
  }

  const emergencyTarget = Math.min(
    remaining,
    emergencyGap > 0 ? Math.max(netPay * 0.15, Math.min(emergencyGap, netPay * 0.25)) : netPay * 0.08,
  );
  if (emergencyTarget > 0) {
    plan.push({
      key: 'emergencyFund',
      label: 'Emergency fund',
      amount: emergencyTarget,
      note: emergencyGap > 0 ? `${formatMoney(emergencyGap)} still needed to hit your goal` : 'Keep the cushion growing',
    });
    remaining -= emergencyTarget;
  }

  const debtTarget = Math.min(remaining, debtRemaining > 0 ? Math.max(netPay * 0.12, Math.min(debtRemaining, netPay * 0.2)) : 0);
  if (debtTarget > 0) {
    plan.push({ key: 'debtPaid', label: 'Debt payoff', amount: debtTarget, note: `${formatMoney(debtRemaining)} still remaining` });
    remaining -= debtTarget;
  }

  if (remaining > 0) {
    plan.push({ key: 'rolloverPool', label: 'Goals / rollover', amount: remaining, note: 'Extra money left after the core plan' });
  }

  return {
    grossPay,
    netPay,
    withheld,
    upcomingBills,
    dueSoonTotal,
    plan,
  };
};

export const getArchiveReportSummary = (
  snapshots: Array<{ month: string; totalSpent: number | string; breakdown?: string | null; savedAt?: string | null }> | null | undefined,
  allAllocs: Array<{ id: string; name: string; icon: string; color: string }>,
) => {
  const rows = [...(snapshots || [])].sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length === 0) {
    return {
      averageSpend: 0,
      bestMonth: null as null | { month: string; totalSpent: number },
      worstMonth: null as null | { month: string; totalSpent: number },
      trendDelta: null as null | number,
      reports: [] as Array<{ month: string; monthLabel: string; totalSpent: number; savedAt: string | null; topCategory: string; topAmount: number; categoriesUsed: number }>,
    };
  }

  const reports = rows.map((snap) => {
    let breakdown: Record<string, number> = {};
    try {
      breakdown = JSON.parse(snap.breakdown || '{}');
    } catch {
      breakdown = {};
    }
    const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const topEntry = entries[0];
    const topAlloc = topEntry ? allAllocs.find((alloc) => alloc.id === topEntry[0]) : null;
    return {
      month: snap.month,
      monthLabel: new Date(`${snap.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalSpent: Number(snap.totalSpent || 0),
      savedAt: snap.savedAt || null,
      topCategory: topAlloc ? `${topAlloc.icon} ${topAlloc.name}` : 'No category data',
      topAmount: topEntry ? Number(topEntry[1] || 0) : 0,
      categoriesUsed: entries.length,
    };
  });

  const totals = reports.map((item) => item.totalSpent);
  const averageSpend = totals.reduce((sum, value) => sum + value, 0) / reports.length;
  const bestMonth = reports.reduce((best, row) => row.totalSpent < best.totalSpent ? row : best, reports[0]);
  const worstMonth = reports.reduce((worst, row) => row.totalSpent > worst.totalSpent ? row : worst, reports[0]);
  const trendDelta = reports.length >= 2 ? reports[reports.length - 1].totalSpent - reports[reports.length - 2].totalSpent : null;

  return {
    averageSpend,
    bestMonth: { month: bestMonth.monthLabel, totalSpent: bestMonth.totalSpent },
    worstMonth: { month: worstMonth.monthLabel, totalSpent: worstMonth.totalSpent },
    trendDelta,
    reports,
  };
};
