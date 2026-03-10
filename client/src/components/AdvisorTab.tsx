import React, { useMemo } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useBills } from "@/hooks/use-bills";
import { formatMoney, getDebtRemaining, getLeftover, getTotalFixed, getUpcomingBills } from "@/lib/budget-utils";
import { PHASE1_ALLOCS } from "@/lib/constants";
import { Loader2, Sparkles, TrendingUp, ShieldCheck, TriangleAlert, CalendarClock, Activity } from "lucide-react";

function getHealthScore(
  settings: { totalDebt: string; debtPaid: string; emergencyFund: string; emergencyGoal: string; paycheck: string; checkingBalance: string; phase: number },
  bills: Array<{ active: boolean; paidMonth: string }>,
  leftover: number
) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const activeBills = bills.filter(b => b.active);
  const paidBills = activeBills.filter(b => b.paidMonth === currentMonth).length;
  const billScore = activeBills.length === 0 ? 25 : Math.round((paidBills / activeBills.length) * 25);

  const emergencyFund = Number(settings.emergencyFund);
  const emergencyGoal = Number(settings.emergencyGoal) || 1;
  const emergencyScore = Math.round(Math.min(emergencyFund / emergencyGoal, 1) * 25);

  const totalDebt = Number(settings.totalDebt);
  const debtPaid = Number(settings.debtPaid);
  let debtScore: number;
  if (totalDebt <= 0) {
    debtScore = 25;
  } else {
    const paidRatio = debtPaid / totalDebt;
    debtScore = Math.round(Math.min(paidRatio, 1) * 25);
  }

  const paycheck = Number(settings.paycheck) || 1;
  let budgetScore: number;
  if (leftover >= paycheck * 0.1) {
    budgetScore = 25;
  } else if (leftover >= 0) {
    budgetScore = 15;
  } else {
    budgetScore = Math.max(0, Math.round(15 + (leftover / paycheck) * 15));
  }

  const total = billScore + emergencyScore + debtScore + budgetScore;
  return { total, billScore, emergencyScore, debtScore, budgetScore, billsTotal: activeBills.length, billsPaid: paidBills };
}

function gradeLabel(score: number) {
  if (score >= 90) return { grade: "A", label: "Excellent", color: "text-success" };
  if (score >= 75) return { grade: "B", label: "Good", color: "text-primary" };
  if (score >= 60) return { grade: "C", label: "Fair", color: "text-warning" };
  if (score >= 45) return { grade: "D", label: "Needs Work", color: "text-orange-400" };
  return { grade: "F", label: "Critical", color: "text-destructive" };
}

function ScoreBar({ label, score, max = 25, color }: { label: string; score: number; max?: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${color}`}>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct >= 80 ? "bg-success" : pct >= 60 ? "bg-primary" : pct >= 40 ? "bg-warning" : "bg-destructive"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AdvisorTab() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: bills, isLoading: billsLoading } = useBills();
  const updateSettings = useUpdateSettings();

  const debtRemaining = getDebtRemaining(settings);
  const leftover = getLeftover(settings, bills);
  const dueSoon = useMemo(() => getUpcomingBills(bills || [], 7), [bills]);
  const recommendation = debtRemaining > 0 ? 1 : 2;

  const monthlyDebtPayment = PHASE1_ALLOCS.find(a => a.id === "debt")?.recommended || 400;
  const monthsToDebtFree = debtRemaining > 0 ? Math.ceil(debtRemaining / monthlyDebtPayment) : 0;
  const debtFreeDate = useMemo(() => {
    if (debtRemaining <= 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToDebtFree);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [debtRemaining, monthsToDebtFree]);

  const healthScore = useMemo(() => {
    if (!settings || !bills) return null;
    return getHealthScore(settings as any, bills, leftover);
  }, [settings, bills, leftover]);

  const grade = healthScore ? gradeLabel(healthScore.total) : null;

  if (settingsLoading || billsLoading || !settings) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const insights = [
    debtRemaining > 0
      ? { icon: TriangleAlert, color: "text-destructive", title: "Debt still exists", body: `You still have ${formatMoney(debtRemaining)} left, so Debt Focus keeps more pressure on cleanup.` }
      : { icon: ShieldCheck, color: "text-success", title: "Debt is cleared", body: "Growth Focus makes more sense now because your monthly cash can build future goals." },
    dueSoon.length > 0
      ? { icon: TriangleAlert, color: dueSoon.length >= 3 ? "text-warning" : "text-primary", title: `${dueSoon.length} bill(s) due in 7 days`, body: `About ${formatMoney(dueSoon.reduce((sum, item) => sum + Number(item.bill.amount), 0))} is coming up soon.` }
      : { icon: ShieldCheck, color: "text-success", title: "No bills due in the next 7 days", body: "This week looks calmer, so your safe-to-spend number should feel less tight." },
    leftover < 0
      ? { icon: TriangleAlert, color: "text-destructive", title: "Monthly plan is too tight", body: `You are currently ${formatMoney(Math.abs(leftover))} under water after bills, buffer, and allocations.` }
      : { icon: TrendingUp, color: leftover < 100 ? "text-warning" : "text-success", title: "Monthly cash flow check", body: `${formatMoney(leftover)} is left after bills, buffer, and allocation targets.` },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {healthScore && grade && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Financial Health Score</h3>
              <p className="text-xs text-muted-foreground">Based on bills, debt, savings, and cash flow</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="flex-shrink-0 w-20 h-20 rounded-full border-4 border-white/10 flex flex-col items-center justify-center"
              style={{ borderColor: healthScore.total >= 75 ? "var(--success)" : healthScore.total >= 50 ? "var(--warning)" : "var(--destructive)", borderWidth: 4 }}>
              <span className={`text-3xl font-black ${grade.color}`}>{grade.grade}</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${grade.color}`}>{healthScore.total}</span>
                <span className="text-muted-foreground text-sm font-medium">/ 100</span>
              </div>
              <div className={`text-sm font-semibold mt-0.5 ${grade.color}`}>{grade.label}</div>
            </div>
          </div>

          <div className="space-y-3">
            <ScoreBar
              label={`Bills paid this month (${healthScore.billsPaid}/${healthScore.billsTotal})`}
              score={healthScore.billScore}
              color={healthScore.billScore >= 20 ? "text-success" : healthScore.billScore >= 12 ? "text-warning" : "text-destructive"}
            />
            <ScoreBar
              label="Emergency fund progress"
              score={healthScore.emergencyScore}
              color={healthScore.emergencyScore >= 20 ? "text-success" : healthScore.emergencyScore >= 12 ? "text-warning" : "text-destructive"}
            />
            <ScoreBar
              label="Debt payoff progress"
              score={healthScore.debtScore}
              color={healthScore.debtScore >= 20 ? "text-success" : healthScore.debtScore >= 12 ? "text-warning" : "text-destructive"}
            />
            <ScoreBar
              label="Monthly budget health"
              score={healthScore.budgetScore}
              color={healthScore.budgetScore >= 20 ? "text-success" : healthScore.budgetScore >= 12 ? "text-warning" : "text-destructive"}
            />
          </div>
        </div>
      )}

      {debtFreeDate && (
        <div className="glass-panel p-6 border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-3 mb-3">
            <CalendarClock className="w-5 h-5 text-destructive" />
            <h3 className="text-sm font-bold text-destructive">Debt Payoff Countdown</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-panel-soft p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Debt remaining</div>
              <div className="text-xl font-bold text-destructive font-mono">{formatMoney(debtRemaining)}</div>
            </div>
            <div className="glass-panel-soft p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Monthly payment</div>
              <div className="text-xl font-bold text-foreground font-mono">{formatMoney(monthlyDebtPayment)}</div>
            </div>
            <div className="glass-panel-soft p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Debt-free by</div>
              <div className="text-lg font-bold text-success">{debtFreeDate}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            At {formatMoney(monthlyDebtPayment)}/month, you'll be completely debt-free in approximately {monthsToDebtFree} month{monthsToDebtFree !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {debtRemaining <= 0 && (
        <div className="glass-panel p-5 border-success/30 bg-success/5 flex items-center gap-4">
          <ShieldCheck className="w-8 h-8 text-success flex-shrink-0" />
          <div>
            <div className="font-bold text-success">Debt-free!</div>
            <div className="text-xs text-muted-foreground mt-1">Your debt is cleared. Focus on building your goals and savings now.</div>
          </div>
        </div>
      )}

      <div className="glass-panel p-6 border-primary/20">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
          <div>
            <h3 className="text-sm font-bold text-primary">Advisor</h3>
            <p className="text-xs text-muted-foreground mt-1">Your recommended strategy based on your real numbers</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Strategy engine
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className={`p-5 rounded-2xl border ${recommendation === 1 ? 'border-destructive/30 bg-destructive/5' : 'border-white/10 bg-white/5'}`}>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Option 1</div>
            <div className="text-xl font-bold text-foreground mb-1">Debt Focus</div>
            <p className="text-sm text-muted-foreground mb-4">Use extra money to finish debt first, then free up more monthly room.</p>
            <button
              onClick={() => updateSettings.mutate({ phase: 1 })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${settings.phase === 1 ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-background border-border text-foreground'}`}
            >
              {settings.phase === 1 ? 'Current strategy' : 'Switch to Debt Focus'}
            </button>
          </div>

          <div className={`p-5 rounded-2xl border ${recommendation === 2 ? 'border-success/30 bg-success/5' : 'border-white/10 bg-white/5'}`}>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Option 2</div>
            <div className="text-xl font-bold text-foreground mb-1">Growth Focus</div>
            <p className="text-sm text-muted-foreground mb-4">Build savings and future goals once debt pressure is gone.</p>
            <button
              onClick={() => updateSettings.mutate({ phase: 2 })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${settings.phase === 2 ? 'bg-success text-success-foreground border-success' : 'bg-background border-border text-foreground'}`}
            >
              {settings.phase === 2 ? 'Current strategy' : 'Switch to Growth Focus'}
            </button>
          </div>
        </div>

        <div className="glass-panel-soft p-4 border border-primary/15">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Advisor recommendation</div>
          <div className="text-2xl font-bold text-foreground mb-2">{recommendation === 1 ? 'Debt Focus' : 'Growth Focus'}</div>
          <p className="text-sm text-muted-foreground">
            {recommendation === 1
              ? 'The app is pushing Debt Focus because remaining debt is still active.'
              : 'The app is pushing Growth Focus because debt no longer needs to be the main target.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="glass-panel p-5">
              <div className={`flex items-center gap-2 text-sm font-bold mb-3 ${item.color}`}><Icon className="w-4 h-4" /> {item.title}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-panel p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Total monthly bills</div>
            <div className="text-xl font-bold font-mono text-foreground">{formatMoney(getTotalFixed(bills))}</div>
          </div>
          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Bills due this week</div>
            <div className="text-xl font-bold font-mono text-foreground">{dueSoon.length}</div>
          </div>
          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Monthly leftover</div>
            <div className={`text-xl font-bold font-mono ${leftover < 0 ? 'text-destructive' : leftover < 100 ? 'text-warning' : 'text-success'}`}>{formatMoney(leftover)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
