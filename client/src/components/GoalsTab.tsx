import React, { useState, useMemo } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useExpenses } from "@/hooks/use-expenses";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";
import { useBills } from "@/hooks/use-bills";
import { formatMoney, getAllocs, getProjectedGoalMoney, getEntertainmentUnused, getAffordability, getMonthsUntil, getLeftover, getSpentByAlloc, calcDeadlinePlanning, PRIORITY_ORDER, getMonthlyGoalPace } from "@/lib/budget-utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, TrendingUp, PiggyBank, CheckCircle2, Loader2, Lock, Unlock, Target, Calendar } from "lucide-react";
import type { UnlockedGoal } from "@shared/schema";

const PROTECTED_IDS = new Set(["emergency", "savings", "apartment"]);

export function GoalsTab() {
  const { data: settings } = useSettings();
  const { data: expenses } = useExpenses();
  const { data: bills } = useBills();
  const { data: goals } = useGoals();
  const updateSettings = useUpdateSettings();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UnlockedGoal | null>(null);
  const [fundingGoalId, setFundingGoalId] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showCategorySweep, setShowCategorySweep] = useState(false);
  const [selectedSweepIds, setSelectedSweepIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "", cost: "", priority: "Medium", note: "", useProtected: false, targetDate: "", locked: false
  });

  const phase = settings?.phase || 1;
  const overridesJson = (settings as any)?.allocOverrides || "{}";
  const namesJson = (settings as any)?.allocNames || "{}";
  const allocs = getAllocs(phase, overridesJson, namesJson);
  const spent = getSpentByAlloc(expenses || []);
  const monthlyPace = getMonthlyGoalPace(settings, expenses || [], bills);

  const sortedGoals = useMemo(() =>
    [...(goals || [])].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)),
    [goals]
  );
  const topPriorityGoal = useMemo(() =>
    sortedGoals.find(g => !g.locked && Number(g.contributed || 0) < Number(g.cost)),
    [sortedGoals]
  );

  const sweepableCategories = useMemo(() => {
    return allocs
      .filter(a => !PROTECTED_IDS.has(a.id) && a.recommended > 0)
      .map(a => {
        const unspent = Math.max(0, a.recommended - (spent[a.id] || 0));
        return { ...a, unspent };
      })
      .filter(a => a.unspent > 0.01);
  }, [allocs, spent]);

  const projected = getProjectedGoalMoney(settings, bills);
  const unusedFun = getEntertainmentUnused(settings, expenses || []);
  const currentPool = Number(settings?.rolloverPool || 0);
  const monthlySurplus = Math.max(0, getLeftover(settings, bills));
  const totalGoalsCost = (goals || []).reduce((sum, g) => sum + Number(g.cost), 0);
  const poolPct = totalGoalsCost > 0 ? Math.min(100, (currentPool / totalGoalsCost) * 100) : 0;
  const poolNeeded = Math.max(0, totalGoalsCost - currentPool);

  const categorySweepTotal = useMemo(() => {
    return sweepableCategories
      .filter(a => selectedSweepIds.has(a.id))
      .reduce((s, a) => s + a.unspent, 0);
  }, [sweepableCategories, selectedSweepIds]);

  const handleSweepSurplus = () => {
    const sweepAmount = monthlySurplus + unusedFun;
    if (sweepAmount <= 0) {
      toast({ title: "Nothing to sweep", description: "There's no surplus to move into the pool this month.", variant: "destructive" });
      return;
    }
    updateSettings.mutate({ rolloverPool: (currentPool + sweepAmount).toFixed(2) }, {
      onSuccess: () => toast({ title: "Surplus swept!", description: `${formatMoney(sweepAmount)} added to your Goals Pool.` })
    });
  };

  const handleCategorySweep = () => {
    if (categorySweepTotal <= 0) {
      toast({ title: "Nothing selected", description: "Select at least one category with unspent funds.", variant: "destructive" });
      return;
    }
    updateSettings.mutate({ rolloverPool: (currentPool + categorySweepTotal).toFixed(2) }, {
      onSuccess: () => {
        toast({ title: "Funds swept!", description: `${formatMoney(categorySweepTotal)} swept from selected categories into your Goals Pool.` });
        setSelectedSweepIds(new Set());
        setShowCategorySweep(false);
      }
    });
  };

  const handleAddFunds = (goal: UnlockedGoal) => {
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid dollar amount greater than zero.", variant: "destructive" });
      return;
    }
    if (amount > currentPool) {
      toast({ title: "Not enough in pool", description: `You only have ${formatMoney(currentPool)} available.`, variant: "destructive" });
      return;
    }
    const newContributed = (Number((goal as any).contributed || 0) + amount).toFixed(2);
    const newPool = (currentPool - amount).toFixed(2);
    updateGoal.mutate({ id: goal.id, contributed: newContributed } as any, {
      onSuccess: () => {
        updateSettings.mutate({ rolloverPool: newPool });
        setFundingGoalId(null);
        setFundAmount("");
        toast({ title: "Funds added!", description: `${formatMoney(amount)} moved from pool to ${goal.name}.` });
      }
    });
  };

  const openForm = (goal?: UnlockedGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({ name: goal.name, cost: Number(goal.cost).toString(), priority: goal.priority, note: goal.note || "", useProtected: goal.useProtected, targetDate: (goal as any).targetDate || "", locked: (goal as any).locked ?? false });
    } else {
      setEditingGoal(null);
      setFormData({ name: "", cost: "", priority: "Medium", note: "", useProtected: false, targetDate: "", locked: false });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: formData.name, cost: parseFloat(formData.cost).toFixed(2), priority: formData.priority, note: formData.note, useProtected: formData.useProtected, targetDate: formData.targetDate || null, locked: formData.locked };
    if (editingGoal) {
      updateGoal.mutate({ id: editingGoal.id, ...payload } as any, { onSuccess: () => setIsFormOpen(false) });
    } else {
      createGoal.mutate(payload as any, { onSuccess: () => setIsFormOpen(false) });
    }
  };

  const handleAutoAllocate = async () => {
    if (currentPool <= 0) {
      toast({ title: "Pool is empty", description: "Sweep some surplus into your Goals Pool first.", variant: "destructive" });
      return;
    }
    let remaining = currentPool;
    let totalAllocated = 0;
    const allocatedGoals: string[] = [];
    for (const goal of sortedGoals) {
      if (remaining <= 0.01) break;
      if ((goal as any).locked) continue;
      const contributed = Number((goal as any).contributed || 0);
      const needed = Math.max(0, Number(goal.cost) - contributed);
      if (needed <= 0) continue;
      const allocate = Math.min(remaining, needed);
      await new Promise<void>(r => updateGoal.mutate({ id: goal.id, contributed: (contributed + allocate).toFixed(2) } as any, { onSuccess: () => r(), onError: () => r() }));
      remaining -= allocate;
      totalAllocated += allocate;
      allocatedGoals.push(goal.name);
    }
    if (totalAllocated > 0) {
      await new Promise<void>(r => updateSettings.mutate({ rolloverPool: remaining.toFixed(2) }, { onSuccess: () => r() }));
      toast({ title: "Auto-allocated!", description: `${formatMoney(totalAllocated)} distributed to: ${allocatedGoals.join(", ")}.` });
    } else {
      toast({ title: "All goals funded", description: "No unfunded goals to allocate to.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="glass-panel p-6 border-success/20 bg-success/5">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-success">Goals Pool</h3>
            <p className="text-xs text-muted-foreground mt-1">Spare money builds up here toward your goals total</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
            {poolPct.toFixed(0)}% funded
          </span>
        </div>

        <div className="w-full bg-white/10 rounded-full h-4 mb-4 overflow-hidden">
          <div className="h-4 rounded-full bg-success transition-all duration-700 ease-out" style={{ width: `${poolPct}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="glass-panel-soft p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Pool balance</div>
            <div className="text-lg font-bold text-success font-mono">{formatMoney(currentPool)}</div>
          </div>
          <div className="glass-panel-soft p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Total goals</div>
            <div className="text-lg font-bold text-foreground font-mono">{formatMoney(totalGoalsCost)}</div>
          </div>
          <div className="glass-panel-soft p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Still needed</div>
            <div className={`text-lg font-bold font-mono ${poolNeeded > 0 ? "text-warning" : "text-success"}`}>{formatMoney(poolNeeded)}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <button
              onClick={handleSweepSurplus}
              className="w-full py-3 bg-success text-success-foreground font-semibold rounded-xl hover:bg-success/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-success/20"
            >
              <TrendingUp className="w-4 h-4" />
              Sweep this month's surplus ({formatMoney(monthlySurplus + unusedFun)})
            </button>
            {topPriorityGoal && (monthlySurplus + unusedFun) > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 px-1 text-xs text-muted-foreground">
                <Target className="w-3 h-3 text-success" />
                <span>Auto-redirect to pool → will go to <strong className="text-foreground">{topPriorityGoal.name}</strong> when you allocate</span>
              </div>
            )}
          </div>

          {currentPool > 0 && (
            <button
              onClick={handleAutoAllocate}
              disabled={updateGoal.isPending || updateSettings.isPending}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {(updateGoal.isPending || updateSettings.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Auto-allocate pool ({formatMoney(currentPool)}) to goals by priority
            </button>
          )}

          <button
            onClick={() => setShowCategorySweep(v => !v)}
            className="w-full py-3 bg-primary/10 text-primary border border-primary/30 font-semibold rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            {showCategorySweep ? "Hide category sweep" : "Sweep unspent category money"}
          </button>

          {showCategorySweep && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <p className="text-xs text-muted-foreground">
                Choose which budget categories have unspent money you'd like to move into your Goals Pool.
                Emergency fund, savings, and savings fund are kept protected and excluded.
              </p>
              {sweepableCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-2">No unspent money in eligible categories right now.</p>
              ) : (
                <div className="space-y-2">
                  {sweepableCategories.map(a => (
                    <label key={a.id} className="flex items-center justify-between gap-3 p-3 bg-background/50 rounded-xl border border-border/30 cursor-pointer hover:border-primary/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedSweepIds.has(a.id)}
                          onChange={e => {
                            const next = new Set(selectedSweepIds);
                            if (e.target.checked) next.add(a.id); else next.delete(a.id);
                            setSelectedSweepIds(next);
                          }}
                          className="accent-primary w-4 h-4"
                        />
                        <span>{a.icon}</span>
                        <span className="text-sm text-foreground">{a.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-success">+{formatMoney(a.unspent)}</div>
                        <div className="text-[10px] text-muted-foreground">unspent</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {sweepableCategories.length > 0 && (
                <button
                  onClick={handleCategorySweep}
                  disabled={categorySweepTotal <= 0 || updateSettings.isPending}
                  className="w-full py-2.5 bg-success text-success-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
                >
                  {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Sweep {categorySweepTotal > 0 ? formatMoney(categorySweepTotal) : "selected"} to pool
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-primary">Future Goals</h3>
            <p className="text-xs text-muted-foreground mt-1">Can you afford this without hurting yourself?</p>
          </div>
          <button
            onClick={() => openForm()}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="glass-panel-soft p-4">
            <div className="text-xs text-muted-foreground mb-1">Projected available money</div>
            <div className="text-2xl font-bold text-success mb-1 font-mono">{formatMoney(projected)}</div>
            <div className="text-xs text-muted-foreground">Savings + big goal fund + pool + leftover</div>
          </div>
          <div className="glass-panel-soft p-4 border border-warning/20">
            <div className="text-xs text-muted-foreground mb-1">Unused fun budget</div>
            <div className="text-2xl font-bold text-warning mb-1 font-mono">{formatMoney(unusedFun)}</div>
            <div className="text-xs text-muted-foreground">Can be swept into goals pool above</div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="glass-panel p-6 border-primary/50 shadow-[0_0_30px_rgba(127,176,255,0.15)] animate-in zoom-in-95 duration-200">
          <h4 className="font-bold text-foreground mb-4">{editingGoal ? "Edit Goal" : "New Future Goal"}</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cost</label>
                <input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Priority</label>
                <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none">
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Note (Optional)</label>
                <input type="text" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Target Date (Optional)</label>
                <input type="month" value={formData.targetDate} onChange={e => setFormData({ ...formData, targetDate: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-white/5 rounded-lg border border-white/10 flex-1">
                <input type="checkbox" checked={formData.useProtected} onChange={e => setFormData({ ...formData, useProtected: e.target.checked })} className="accent-primary w-4 h-4" />
                <span className="text-sm text-foreground">Count protected money toward this goal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-white/5 rounded-lg border border-white/10">
                <input type="checkbox" checked={formData.locked} onChange={e => setFormData({ ...formData, locked: e.target.checked })} className="accent-primary w-4 h-4" />
                <div>
                  <div className="text-sm text-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</div>
                  <div className="text-[10px] text-muted-foreground">Skip auto-allocate</div>
                </div>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={createGoal.isPending || updateGoal.isPending} className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-50 flex items-center gap-2">
                {(createGoal.isPending || updateGoal.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingGoal ? "Save Changes" : "Create Goal"}
              </button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2 bg-transparent text-foreground border border-border rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {sortedGoals.length === 0 && (
          <div className="glass-panel p-8 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <div className="text-lg font-semibold text-foreground mb-1">No goals yet</div>
            <div className="text-sm text-muted-foreground">Tap "Add Goal" above to set your first savings target.</div>
          </div>
        )}
        {sortedGoals.map(g => {
          const info = getAffordability(g, settings, bills);
          const months = getMonthsUntil(Number(g.cost), settings, expenses || [], bills);
          const contributed = Number((g as any).contributed || 0);
          const goalCost = Number(g.cost);
          const contributedPct = goalCost > 0 ? Math.min(100, (contributed / goalCost) * 100) : 0;
          const isFullyFunded = contributed >= goalCost && goalCost > 0;
          const isLocked = (g as any).locked;
          const targetDate = (g as any).targetDate;
          const deadlinePlan = targetDate ? calcDeadlinePlanning(goalCost, contributed, targetDate, monthlyPace) : null;
          const isTopGoal = topPriorityGoal?.id === g.id;

          let label = "Not safe yet", statusColorClass = "text-destructive", statusBg = "bg-destructive/15 border-destructive/30";
          if (isFullyFunded) { label = "Fully Funded ✓"; statusColorClass = "text-success"; statusBg = "bg-success/20 border-success/40"; }
          else if (info.level === "green") { label = "Unlocked"; statusColorClass = "text-success"; statusBg = "bg-success/15 border-success/30"; }
          else if (info.level === "yellow") { label = "Close"; statusColorClass = "text-warning"; statusBg = "bg-warning/15 border-warning/30"; }

          const priorityBadgeClass = g.priority === "High" ? "text-red-400 bg-red-400/10 border-red-400/30" : g.priority === "Medium" ? "text-amber-400 bg-amber-400/10 border-amber-400/30" : "text-blue-400 bg-blue-400/10 border-blue-400/30";
          const isFunding = fundingGoalId === g.id;

          return (
            <div key={g.id} className={`glass-panel p-6 border ${statusBg}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
                    {isTopGoal && !isFullyFunded && <span className="text-[10px] px-1.5 py-0.5 bg-success/20 text-success border border-success/30 rounded-full font-semibold uppercase tracking-wide shrink-0">Next up</span>}
                    {g.name}
                    {isFullyFunded && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${priorityBadgeClass}`}>{g.priority}</span>
                    {isLocked && <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold text-muted-foreground bg-white/5 border-white/10 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                    {targetDate && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {new Date(targetDate + "-01T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
                    {g.note && <span className="text-[10px] text-muted-foreground/70 italic">{g.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => updateGoal.mutate({ id: g.id, locked: !isLocked } as any)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors" title={isLocked ? "Unlock" : "Lock"}>
                    {isLocked ? <Lock className="w-3.5 h-3.5 text-warning" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border bg-background/50 ${statusColorClass} ${statusBg.split(' ')[1]}`}>{label}</div>
                </div>
              </div>

              {deadlinePlan && !isFullyFunded && (
                <div className={`mb-3 p-3 rounded-xl border text-xs ${deadlinePlan.isAhead ? "bg-success/8 border-success/20" : "bg-destructive/8 border-destructive/20"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-bold ${deadlinePlan.isAhead ? "text-success" : "text-destructive"}`}>
                      {deadlinePlan.isAhead ? "🟢 Ahead of schedule" : "🔴 Behind schedule"}
                    </span>
                    <span className="text-muted-foreground font-mono">{deadlinePlan.monthsLeft} months left</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {deadlinePlan.isAhead
                      ? <>Saving {formatMoney(monthlyPace)}/mo · need {formatMoney(deadlinePlan.required)}/mo</>
                      : <>Need {formatMoney(deadlinePlan.required)}/mo · saving {formatMoney(monthlyPace)}/mo · <span className="text-destructive">+{formatMoney(deadlinePlan.deficit)}/mo needed</span></>
                    }
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><PiggyBank className="w-3 h-3" /> Contributed toward this goal</span>
                  <span className="font-mono font-semibold">{formatMoney(contributed)} / {formatMoney(goalCost)} ({contributedPct.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div className="h-2.5 rounded-full bg-success transition-all duration-500" style={{ width: `${contributedPct}%` }} />
                </div>
              </div>

              {!isFullyFunded && currentPool > 0 && (
                <div className="mb-4">
                  {!isFunding ? (
                    <button
                      onClick={() => { setFundingGoalId(g.id); setFundAmount(""); }}
                      className="flex items-center gap-2 px-4 py-2 bg-success/10 hover:bg-success/20 text-success border border-success/30 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add funds from pool ({formatMoney(currentPool)} available)
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[120px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                        <input
                          type="number" step="0.01"
                          value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-background border border-border rounded-xl pl-6 pr-3 py-2 text-sm font-mono focus:border-success outline-none"
                          autoFocus
                        />
                      </div>
                      <button onClick={() => handleAddFunds(g)} className="px-4 py-2 bg-success text-success-foreground font-semibold rounded-xl text-sm">Add</button>
                      <button onClick={() => setFundingGoalId(null)} className="px-4 py-2 border border-border text-foreground rounded-xl text-sm">Cancel</button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="glass-panel-soft p-4">
                  <div className="text-xs text-muted-foreground mb-1">Goal Cost</div>
                  <div className="text-xl font-bold text-foreground font-mono">{formatMoney(g.cost)}</div>
                </div>
                <div className="glass-panel-soft p-4">
                  <div className="text-xs text-muted-foreground mb-1">Safe money check</div>
                  <div className={`text-xl font-bold font-mono ${info.diff >= 0 ? 'text-success' : info.level === 'yellow' ? 'text-warning' : 'text-destructive'}`}>
                    {formatMoney(info.money)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {info.diff >= 0 ? 'You can cover it safely' : `Need ${formatMoney(Math.abs(info.diff))} more`}
                  </div>
                </div>
              </div>

              <p className="text-sm bg-white/5 p-4 rounded-xl border border-white/10 mb-4 leading-relaxed text-muted-foreground">
                {isFullyFunded
                  ? <><span className="text-success font-semibold">This goal is fully funded!</span> You've contributed enough to cover the full cost.</>
                  : info.diff >= 0
                    ? <><span className="text-foreground font-semibold">You can afford {g.name}</span> without financially hurting yourself based on the money this app treats as available.</>
                    : <>At your current pace, {months === null ? 'there is no projection yet' : <>about <strong className="text-foreground">{months} month(s)</strong> to reach this safely</>}.</>}
              </p>

              <div className="flex justify-between items-center pt-4 border-t border-border/20">
                <span className="text-xs bg-card-soft px-3 py-1.5 rounded-md text-muted-foreground border border-border">
                  {g.useProtected ? 'Uses protected money' : 'Protected money stays protected'}
                </span>
                <div className="flex gap-2">
                  {confirmDeleteId === g.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <button
                        onClick={() => deleteGoal.mutate(g.id, { onSuccess: () => setConfirmDeleteId(null) })}
                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded-lg text-xs font-semibold"
                      >
                        Yes
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1 border border-border text-foreground rounded-lg text-xs">No</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => openForm(g)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(g.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
