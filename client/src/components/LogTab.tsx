import React, { useState, useMemo } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useExpenses, useCreateExpense } from "@/hooks/use-expenses";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/use-templates";
import { formatMoney, getAllocs, getSpentByAlloc } from "@/lib/budget-utils";
import { Loader2, Trash2, Bookmark, BookmarkCheck } from "lucide-react";

export function LogTab({ onComplete }: { onComplete: () => void }) {
  const { data: settings } = useSettings();
  const { data: expenses } = useExpenses();
  const { data: templates } = useTemplates();
  const createExpense = useCreateExpense();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [allocId, setAllocId] = useState("");
  const [note, setNote] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const allocs = useMemo(() => {
    return getAllocs(
      settings?.phase || 1,
      (settings as any)?.allocOverrides,
      (settings as any)?.allocNames
    ).filter(a => a.recommended > 0);
  }, [settings?.phase, (settings as any)?.allocOverrides, (settings as any)?.allocNames]);

  React.useEffect(() => {
    if (allocs.length > 0 && !allocId) {
      setAllocId(allocs[0].id);
    }
  }, [allocs, allocId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim() || Number.isNaN(numAmount) || numAmount <= 0 || !allocId) return;

    createExpense.mutate(
      {
        name: name.trim(),
        amount: numAmount.toFixed(2),
        allocId,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          if (saveAsTemplate) {
            const alloc = allocs.find(a => a.id === allocId);
            createTemplate.mutate({
              name: name.trim(),
              amount: numAmount.toFixed(2),
              allocId,
              icon: alloc?.icon || "📝",
            });
          }
          setName("");
          setAmount("");
          setNote("");
          setSaveAsTemplate(false);
          onComplete();
        }
      }
    );
  };

  const applyTemplate = (t: NonNullable<typeof templates>[number]) => {
    setName(t.name);
    setAmount(Number(t.amount).toString());
    setAllocId(t.allocId);
  };

  const selectedAlloc = allocs.find(a => a.id === allocId);
  const currentSpent = getSpentByAlloc(expenses || [])[allocId] || 0;
  const nextSpent = currentSpent + (parseFloat(amount) || 0);
  const overBudget = selectedAlloc && nextSpent > selectedAlloc.recommended;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {templates && templates.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
            <BookmarkCheck className="w-3.5 h-3.5" /> Quick add
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => {
              const alloc = allocs.find(a => a.id === t.allocId);
              return (
                <div key={t.id} className="group flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 rounded-xl cursor-pointer transition-colors" onClick={() => applyTemplate(t)}>
                  <span className="text-base">{t.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-foreground leading-none">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatMoney(t.amount)}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTemplate.mutate(t.id); }}
                    className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove shortcut"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-primary">Log a spend</h3>
            <p className="text-xs text-muted-foreground mt-1">Add what you spent and see the impact right away</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
            ⚡ Quick add
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground block mb-2 font-medium">What?</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted/50"
              placeholder="Chipotle, Uber, groceries..."
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2 font-medium">How much?</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl pl-8 pr-4 py-3 text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted/50"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2 font-medium">Category</label>
            <select
              value={allocId}
              onChange={(e) => setAllocId(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none cursor-pointer"
            >
              {allocs.map(a => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2 font-medium">Note <span className="opacity-50">(optional)</span></label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted/50"
              placeholder="e.g. lunch with coworkers, Amazon order..."
            />
          </div>

          {selectedAlloc && parseFloat(amount) > 0 && (
            <div className="glass-panel-soft p-4 mt-2">
              <span className="text-xs text-muted-foreground">After this: </span>
              <strong className={`font-mono text-sm ml-2 ${overBudget ? 'text-destructive' : 'text-success'}`}>
                {formatMoney(nextSpent)} / {formatMoney(selectedAlloc.recommended)}
                {overBudget ? ' ⚠️ over budget' : ' ✓'}
              </strong>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/10 hover:border-primary/20 transition-colors">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={e => setSaveAsTemplate(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <div className="flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-foreground">Save as quick-add shortcut</span>
            </div>
          </label>

          <button
            type="submit"
            disabled={createExpense.isPending}
            className="w-full py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold rounded-xl hover:shadow-[0_0_20px_rgba(127,176,255,0.4)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-2"
          >
            {createExpense.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "+ Add Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
