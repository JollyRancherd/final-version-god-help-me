import React, { useEffect, useMemo, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useBills } from "@/hooks/use-bills";
import { getDebtRemaining, formatMoney, getStatusData, nextDueDays } from "@/lib/budget-utils";
import { TOTAL_DEBT, EMERGENCY_GOAL, APARTMENT_GOAL } from "@/lib/constants";
import { ProgressRing } from "@/components/ProgressRing";
import { DashboardTab } from "@/components/DashboardTab";
import { BudgetTab } from "@/components/BudgetTab";
import { BillsTab } from "@/components/BillsTab";
import { CalendarTab } from "@/components/CalendarTab";
import { AdvisorTab } from "@/components/AdvisorTab";
import { LogTab } from "@/components/LogTab";
import { HistoryTab } from "@/components/HistoryTab";
import { GoalsTab } from "@/components/GoalsTab";
import { ToolsTab } from "@/components/ToolsTab";
import { Loader2, LayoutDashboard, PieChart, Calendar, PenLine, Receipt, History, Target, Wrench, Edit2, Check, Clock3, Sparkles, LogOut } from "lucide-react";
import { useAuth, useLogout } from "@/hooks/use-auth";

const currentMonthKey = new Date().toISOString().slice(0, 7);

export default function Home() {
  const { data: settings, isLoading } = useSettings();
  const { data: bills } = useBills();
  const updateSettings = useUpdateSettings();
  const { data: authUser } = useAuth();
  const logout = useLogout();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isEditingPaycheck, setIsEditingPaycheck] = useState(false);
  const [paycheckInput, setPaycheckInput] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = settings?.phase || 1;
  const currentPlan = useMemo(() => {
    if (phase === 1) {
      return {
        title: "Debt Focus",
        subtitle: "Knock out debt first, then free up more cash every month.",
        chip: "Advisor priority",
      };
    }
    return {
      title: "Growth / Move-Out Focus",
      subtitle: "Debt is handled, so the plan shifts toward savings goals.",
      chip: "Next-level plan",
    };
  }, [phase]);

  const billsDueSoon = useMemo(() => {
    return (bills || []).some(
      b => b.active !== false &&
        nextDueDays(b.dueDay) <= 3 &&
        (b as any).paidMonth !== currentMonthKey
    );
  }, [bills]);

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-primary">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <h1 className="font-display font-bold tracking-widest text-lg animate-pulse">LOADING BUDGET...</h1>
      </div>
    );
  }

  const debtRem = getDebtRemaining(settings);
  const status = getStatusData(settings, bills);
  const recommendedPhase = debtRem > 0 ? 1 : 2;

  const savePaycheck = () => {
    const v = parseFloat(paycheckInput);
    if (!Number.isNaN(v) && v > 0) {
      updateSettings.mutate({ paycheck: v.toFixed(2) });
      setIsEditingPaycheck(false);
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, badge: false },
    { id: "advisor", label: "Advisor", icon: Sparkles, badge: false },
    { id: "budget", label: "Budget", icon: PieChart, badge: false },
    { id: "calendar", label: "Calendar", icon: Calendar, badge: false },
    { id: "bills", label: "Bills", icon: Receipt, badge: billsDueSoon },
    { id: "log", label: "Log", icon: PenLine, badge: false },
    { id: "history", label: "History", icon: History, badge: false },
    { id: "unlocked", label: "Goals", icon: Target, badge: false },
    { id: "tools", label: "Tools", icon: Wrench, badge: false },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-28">
      <header className="mb-8 space-y-6">
        <div className="flex justify-between items-center glass-panel p-2 pl-6 gap-4 flex-wrap">
          <div>
            <div className="font-display font-bold text-xl tracking-wider text-foreground uppercase">
              {(authUser?.username || "My")}<span className="text-primary opacity-60">Budget</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" /> Advisor recommends {recommendedPhase === 1 ? "Debt Focus" : "Growth / Move-Out Focus"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => logout.mutate()} className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-foreground flex items-center gap-2">
              <LogOut className="w-3 h-3" /> Log out
            </button>
          <div className="flex bg-card-soft p-1 rounded-xl border border-white/5">
            <button
              onClick={() => updateSettings.mutate({ phase: 1 })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${phase === 1 ? 'bg-destructive text-destructive-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Debt Focus
            </button>
            <button
              onClick={() => updateSettings.mutate({ phase: 2 })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${phase === 2 ? 'bg-success text-success-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Growth Focus
            </button>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`glass-panel p-5 border-l-4 ${phase === 1 ? 'border-l-destructive' : 'border-l-success'} sm:col-span-2`}>
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{currentPlan.chip}</div>
                <h2 className={`font-display text-2xl font-bold mb-1 ${phase === 1 ? 'text-destructive' : 'text-success'}`}>{currentPlan.title}</h2>
                <p className="text-sm text-muted-foreground">{currentPlan.subtitle}</p>
              </div>
              {recommendedPhase === phase ? (
                <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-success/10 text-success border border-success/20">Recommended</span>
              ) : (
                <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">Manual override</span>
              )}
            </div>
          </div>

          <div className="glass-panel p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock3 className="w-3 h-3" /> Today</div>
            <div className="text-lg font-bold text-foreground">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div className="text-2xl font-mono font-bold text-primary mt-1">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-panel p-5 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${status.bg} ${status.color}`}>{status.text}</span>
            </div>
            <div className="flex items-baseline gap-4 mt-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Monthly Income</div>
                <div className="text-xl font-bold text-foreground font-mono">{formatMoney(Number(settings.paycheck || 0) * 2)}</div>
              </div>
              <div className="h-8 w-px bg-border/30"></div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                  Per Paycheck
                  {!isEditingPaycheck && (
                    <button onClick={() => { setIsEditingPaycheck(true); setPaycheckInput(settings.paycheck?.toString() || ""); }} className="hover:text-primary transition-colors"><Edit2 className="w-3 h-3" /></button>
                  )}
                </div>
                {isEditingPaycheck ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus type="number" value={paycheckInput} onChange={e => setPaycheckInput(e.target.value)} className="w-24 bg-background border border-primary rounded px-2 py-0.5 text-sm font-mono outline-none" />
                    <button onClick={savePaycheck} className="text-success"><Check className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="text-xl font-bold text-primary font-mono">{formatMoney(settings.paycheck)}</div>
                )}
              </div>
            </div>
          </div>

          <div className={`glass-panel p-6 border flex justify-between items-center transition-all duration-700 ${debtRem === 0 ? 'border-success/50 bg-success/5 animate-pulse-green' : 'border-destructive/30 bg-destructive/5'}`}>
            <div>
              <h3 className="text-sm font-bold text-foreground mb-1">Remaining Debt</h3>
              <p className="text-xs text-muted-foreground">
                {debtRem === 0 ? <span className="text-success font-semibold">Growth Focus makes the most sense now.</span> : <>Keep the app on <span className="text-destructive font-semibold">Debt Focus</span> until this hits zero.</>}
              </p>
            </div>
            <div className={`font-display text-3xl font-bold font-mono tracking-tight ${debtRem === 0 ? 'text-success text-gradient-success' : 'text-destructive text-gradient-danger'}`}>
              {debtRem === 0 ? "🎉 DEBT FREE!" : formatMoney(debtRem)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ProgressRing value={settings.emergencyFund} max={Number((settings as any).emergencyGoal) || EMERGENCY_GOAL} label="Emergency Fund" color="hsl(var(--primary))" settingsKey="emergencyFund" />
          <ProgressRing value={settings.apartmentFund} max={Number((settings as any).apartmentGoal) || APARTMENT_GOAL} label={(settings as any).bigGoalName || "Big Goal"} color="hsl(var(--warning))" settingsKey="apartmentFund" />
          <ProgressRing value={settings.debtPaid} max={Number((settings as any).totalDebt) || TOTAL_DEBT} label="Debt Cleared" color="hsl(var(--destructive))" settingsKey="debtPaid" />
        </div>
      </header>

      <main className="min-h-[500px]">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "advisor" && <AdvisorTab />}
        {activeTab === "budget" && <BudgetTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "bills" && <BillsTab />}
        {activeTab === "log" && <LogTab onComplete={() => setActiveTab("history")} />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "unlocked" && <GoalsTab />}
        {activeTab === "tools" && <ToolsTab />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-background/85 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
            <div className="overflow-x-auto hide-scrollbar">
              <div className="flex px-2 py-2 gap-0.5 min-w-max">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[58px] ${
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }`}
                    >
                      {tab.badge && (
                        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-destructive shadow-[0_0_6px_rgba(255,80,80,0.8)]" />
                      )}
                      <Icon className={`w-[18px] h-[18px] transition-all duration-200 ${isActive ? 'scale-110' : ''}`} />
                      <span className={`text-[9px] font-bold leading-none tracking-wide ${isActive ? 'text-primary' : ''}`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
