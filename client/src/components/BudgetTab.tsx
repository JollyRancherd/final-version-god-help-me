import React, { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useExpenses } from "@/hooks/use-expenses";
import { useBills } from "@/hooks/use-bills";
import { formatMoney, getAllocs, getTotalFixed, getLeftover, getSpentByAlloc } from "@/lib/budget-utils";
import { BUFFER } from "@/lib/constants";
import { Edit2, Save, X } from "lucide-react";

export function BudgetTab() {
  const { data: settings } = useSettings();
  const { data: expenses } = useExpenses();
  const { data: bills } = useBills();
  const updateSettings = useUpdateSettings();

  const [editing, setEditing] = useState(false);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const phase = settings?.phase || 1;
  const overridesJson = (settings as any)?.allocOverrides || "{}";
  const namesJson = (settings as any)?.allocNames || "{}";
  const allocs = getAllocs(phase, overridesJson, namesJson);
  const spent = getSpentByAlloc(expenses || []);
  const leftover = getLeftover(settings, bills);

  useEffect(() => {
    if (settings && editing) {
      const savedAmounts: Record<string, number> = (() => { try { return JSON.parse(overridesJson); } catch { return {}; } })();
      const savedNames: Record<string, string> = (() => { try { return JSON.parse(namesJson); } catch { return {}; } })();
      const baseAllocs = getAllocs(phase);
      const amounts: Record<string, string> = {};
      const names: Record<string, string> = {};
      baseAllocs.forEach(a => {
        amounts[a.id] = (savedAmounts[a.id] !== undefined ? savedAmounts[a.id] : a.recommended).toString();
        names[a.id] = savedNames[a.id] || a.name;
      });
      setDraftAmounts(amounts);
      setDraftNames(names);
    }
  }, [editing, settings]);

  const handleSave = () => {
    const baseAllocs = getAllocs(phase);
    const overrides: Record<string, number> = {};
    const customNames: Record<string, string> = {};
    baseAllocs.forEach(a => {
      const v = parseFloat(draftAmounts[a.id] || "0");
      if (!isNaN(v) && v !== a.recommended) overrides[a.id] = v;
      const customName = (draftNames[a.id] || "").trim();
      if (customName && customName !== a.name) customNames[a.id] = customName;
    });
    updateSettings.mutate({
      allocOverrides: JSON.stringify(overrides),
      allocNames: JSON.stringify(customNames),
    } as any, {
      onSuccess: () => setEditing(false)
    });
  };

  const totalAllocs = editing
    ? Object.values(draftAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    : allocs.reduce((s, a) => s + a.recommended, 0);

  if (!settings) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-primary">
              {phase === 1 ? "Debt Focus Budget" : "Growth Focus Budget"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {editing ? "Edit names and spending targets for each category" : "See what is planned versus what you actually spent"}
            </p>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success text-success-foreground text-xs font-semibold hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {updateSettings.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          )}
        </div>

        <div className="glass-panel-soft p-4 flex justify-between items-center mb-6">
          <div>
            <div className="text-sm font-bold text-foreground">Fixed Bills</div>
            <div className="text-xs text-muted-foreground mt-1">Built from your editable recurring bills</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground font-mono">{formatMoney(getTotalFixed(bills))}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">monthly</div>
          </div>
        </div>

        {editing && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Change the <strong className="text-foreground">name</strong> to whatever fits your life, and set your own <strong className="text-foreground">budget amount</strong>. Categories with $0 are hidden in the expense log but still tracked here.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {allocs.map((a) => {
            const current = spent[a.id] || 0;
            const budgetAmt = editing ? (parseFloat(draftAmounts[a.id] || "0") || 0) : a.recommended;
            const pct = budgetAmt > 0 ? Math.min(100, (current / budgetAmt) * 100) : 0;
            const overBudget = current > budgetAmt && budgetAmt > 0;

            return (
              <div key={a.id} className={`p-4 rounded-xl border ${overBudget ? 'bg-destructive/5 border-destructive/20' : 'bg-white/5 border-white/5'}`}>
                {editing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{a.icon}</span>
                      <input
                        type="text"
                        value={draftNames[a.id] ?? a.name}
                        onChange={e => setDraftNames(prev => ({ ...prev, [a.id]: e.target.value }))}
                        placeholder={a.name}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-semibold focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Budget $</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={draftAmounts[a.id] ?? a.recommended.toString()}
                        onChange={e => setDraftAmounts(prev => ({ ...prev, [a.id]: e.target.value }))}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:border-primary outline-none"
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                        spent: {formatMoney(current)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span>{a.icon}</span> {a.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{a.note}</div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-base font-bold font-mono" style={{ color: a.recommended === 0 ? 'hsl(var(--muted-foreground))' : a.color }}>
                          {a.recommended === 0 ? "—" : formatMoney(a.recommended)}
                        </div>
                        {current > 0 && (
                          <div className={`text-xs font-mono mt-1 ${overBudget ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                            spent: {formatMoney(current)}
                          </div>
                        )}
                      </div>
                    </div>
                    {budgetAmt > 0 && (
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 ease-out rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: overBudget ? 'hsl(var(--destructive))' : a.color
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel p-6 space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Fixed Bills</span>
          <strong className="font-mono text-foreground">{formatMoney(getTotalFixed(bills))}</strong>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Allocations</span>
          <strong className="font-mono text-foreground">{formatMoney(totalAllocs)}</strong>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Buffer (locked)</span>
          <strong className="font-mono text-warning">{formatMoney(BUFFER)}</strong>
        </div>

        <div className="h-px w-full bg-border/20 my-2"></div>

        <div className="glass-panel-soft p-4 flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">Unallocated</span>
          <span className={`text-xl font-bold font-mono ${leftover < 0 ? 'text-destructive' : leftover < 50 ? 'text-warning' : 'text-success'}`}>
            {formatMoney(leftover)}
          </span>
        </div>
      </div>

      <div className="glass-panel p-5 border-primary/10 bg-primary/3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏛️</span>
          <div>
            <div className="text-sm font-bold text-foreground mb-1">Where do taxes fit?</div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              There are a few ways to handle taxes in this app depending on your situation:
            </p>
            <div className="space-y-2">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs font-semibold text-foreground mb-0.5">Tax refund coming</div>
                <div className="text-xs text-muted-foreground">Add the refund to your checking balance when you do your next New Paycheck — treat it like extra income for that cycle.</div>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs font-semibold text-foreground mb-0.5">Tax bill you owe</div>
                <div className="text-xs text-muted-foreground">Log it as a one-time expense under the "Taxes / IRS" category, or add it to Bills if you're paying in installments.</div>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs font-semibold text-foreground mb-0.5">Self-employed / quarterly taxes</div>
                <div className="text-xs text-muted-foreground">Set a budget amount on the "Taxes / IRS" category above so money gets reserved each cycle. Add a recurring bill for each quarterly payment due date.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
