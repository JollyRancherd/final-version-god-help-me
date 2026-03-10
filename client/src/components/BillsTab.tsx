import React, { useMemo, useState } from "react";
import { formatMoney, nextDueDays, getTotalFixed } from "@/lib/budget-utils";
import { useBills, useCreateBill, useUpdateBill, useDeleteBill } from "@/hooks/use-bills";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Save, Trash2, Plus, X, CalendarDays, CheckCircle2, Circle, AlertTriangle } from "lucide-react";

const currentMonthKey = new Date().toISOString().slice(0, 7);

const emptyForm = { name: "", amount: "", icon: "💸", note: "", dueDay: "1", active: true, autopay: false };

export function BillsTab() {
  const { data: bills, isLoading } = useBills();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, typeof emptyForm>>({});
  const [adding, setAdding] = useState(false);
  const [newBill, setNewBill] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const upcoming = useMemo(() => (bills || []).filter(b => b.active !== false).sort((a, b) => nextDueDays(a.dueDay) - nextDueDays(b.dueDay)), [bills]);

  const paidCount = useMemo(() => (bills || []).filter(b => (b as any).paidMonth === currentMonthKey).length, [bills]);
  const paidAmount = useMemo(() => (bills || []).filter(b => (b as any).paidMonth === currentMonthKey).reduce((sum, b) => sum + Number(b.amount), 0), [bills]);
  const unpaidAmount = useMemo(() => (bills || []).filter(b => b.active !== false && (b as any).paidMonth !== currentMonthKey).reduce((sum, b) => sum + Number(b.amount), 0), [bills]);

  const startEdit = (bill: NonNullable<typeof bills>[number]) => {
    setEditingId(bill.id);
    setDrafts(prev => ({ ...prev, [bill.id]: { name: bill.name, amount: String(bill.amount), icon: bill.icon, note: bill.note, dueDay: String(bill.dueDay), active: bill.active, autopay: (bill as any).autopay ?? false } }));
  };

  const saveEdit = (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    updateBill.mutate({
      id,
      updates: {
        name: draft.name,
        amount: Number(draft.amount || 0).toFixed(2),
        icon: draft.icon || "💸",
        note: draft.note,
        dueDay: Number(draft.dueDay),
        active: draft.active,
        autopay: draft.autopay,
      }
    }, {
      onSuccess: () => {
        setEditingId(null);
        toast({ title: "Bill updated", description: `${draft.name} has been saved.` });
      }
    });
  };

  const submitNewBill = () => {
    createBill.mutate({
      name: newBill.name,
      amount: Number(newBill.amount || 0).toFixed(2),
      icon: newBill.icon || "💸",
      note: newBill.note,
      dueDay: Number(newBill.dueDay),
      active: newBill.active,
      autopay: newBill.autopay,
    }, {
      onSuccess: () => {
        setAdding(false);
        setNewBill(emptyForm);
        toast({ title: "Bill added", description: `${newBill.name} has been added to your bills.` });
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    deleteBill.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        toast({ title: "Bill removed", description: `${name} has been deleted.` });
      }
    });
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-primary">Recurring Bills</h3>
            <p className="text-xs text-muted-foreground mt-1">Track due dates, mark paid, edit amounts any time.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">⏰ Smart due-date view</span>
            <button onClick={() => setAdding(v => !v)} className="px-3 py-2 rounded-xl bg-card-soft border border-border text-sm font-semibold hover:bg-white/5 flex items-center gap-2">
              {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {adding ? "Close" : "Add bill"}
            </button>
          </div>
        </div>
      </div>

      {adding && (
        <div className="glass-panel p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">New bill</p>
          <div className="grid grid-cols-2 gap-3">
            <input className="col-span-2 bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Bill name (e.g. Netflix)" value={newBill.name} onChange={e => setNewBill(v => ({ ...v, name: e.target.value }))} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
              <input className="w-full bg-background border border-border rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono" placeholder="0.00" type="number" step="0.01" value={newBill.amount} onChange={e => setNewBill(v => ({ ...v, amount: e.target.value }))} />
            </div>
            <input className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Due day (1–31)" type="number" min={1} max={31} value={newBill.dueDay} onChange={e => setNewBill(v => ({ ...v, dueDay: e.target.value }))} />
            <input className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Emoji icon (e.g. 📺)" value={newBill.icon} onChange={e => setNewBill(v => ({ ...v, icon: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground px-1 cursor-pointer">
              <input type="checkbox" checked={newBill.active} onChange={e => setNewBill(v => ({ ...v, active: e.target.checked }))} className="accent-primary w-4 h-4" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground px-1 cursor-pointer">
              <input type="checkbox" checked={newBill.autopay} onChange={e => setNewBill(v => ({ ...v, autopay: e.target.checked }))} className="accent-primary w-4 h-4" />
              Autopay
            </label>
          </div>
          <input className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Optional note" value={newBill.note} onChange={e => setNewBill(v => ({ ...v, note: e.target.value }))} />
          <button disabled={createBill.isPending || !newBill.name || !newBill.amount} onClick={submitNewBill} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50">
            {createBill.isPending ? "Saving..." : "Save bill"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-4">
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="glass-panel p-8 text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="text-lg font-semibold text-foreground mb-1">No bills yet</div>
              <div className="text-sm text-muted-foreground">Tap + to add your recurring bills and subscriptions.</div>
            </div>
          )}
          {upcoming.map(bill => {
            const days = nextDueDays(bill.dueDay);
            const isDanger = days <= 2;
            const isWarn = days > 2 && days <= 7;
            const draft = drafts[bill.id];
            const editing = editingId === bill.id;
            const dueText = days === 0 ? "today" : `${days} day(s)`;
            const isPaid = (bill as any).paidMonth === currentMonthKey;

            return (
              <div key={bill.id} className={`glass-panel p-4 transition-all ${isDanger && !isPaid ? 'border-destructive/30 bg-destructive/5' : isWarn && !isPaid ? 'border-warning/30 bg-warning/5' : ''}`}>
                {confirmDeleteId === bill.id ? (
                  <div className="flex items-start gap-3 p-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Delete "{bill.name}"?</p>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-3">This removes it from your bills list permanently.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(bill.id, bill.name)} disabled={deleteBill.isPending} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-semibold disabled:opacity-50">
                          {deleteBill.isPending ? "Deleting..." : "Yes, Delete"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 border border-border text-foreground rounded-lg text-xs">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input className="col-span-2 bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Bill name" value={draft?.name || ""} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], name: e.target.value } }))} />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                        <input className="w-full bg-background border border-border rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono" type="number" step="0.01" value={draft?.amount || ""} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], amount: e.target.value } }))} />
                      </div>
                      <input className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm" type="number" min={1} max={31} placeholder="Due day" value={draft?.dueDay || ""} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], dueDay: e.target.value } }))} />
                      <input className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Emoji icon" value={draft?.icon || ""} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], icon: e.target.value } }))} />
                      <label className="flex items-center gap-2 text-sm text-muted-foreground px-1 cursor-pointer">
                        <input type="checkbox" checked={draft?.active ?? true} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], active: e.target.checked } }))} className="accent-primary w-4 h-4" />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground px-1 cursor-pointer">
                        <input type="checkbox" checked={draft?.autopay ?? false} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], autopay: e.target.checked } }))} className="accent-primary w-4 h-4" />
                        Autopay
                      </label>
                    </div>
                    <input className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Optional note" value={draft?.note || ""} onChange={e => setDrafts(prev => ({ ...prev, [bill.id]: { ...prev[bill.id], note: e.target.value } }))} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(bill.id)} disabled={updateBill.isPending} className="px-3 py-2 rounded-xl bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {updateBill.isPending ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-xl bg-card-soft border border-border text-sm font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => updateBill.mutate({ id: bill.id, updates: { paidMonth: isPaid ? "" : currentMonthKey } })}
                        className={`flex-shrink-0 transition-colors ${isPaid ? 'text-success' : 'text-muted-foreground hover:text-success'}`}
                        title={isPaid ? "Mark unpaid" : "Mark as paid"}
                      >
                        {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold flex items-center gap-2 ${isPaid ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          <span>{bill.icon}</span>
                          <span className="truncate">{bill.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{bill.note || "No note"} · due day {bill.dueDay}{bill.active === false ? ' · paused' : ''}</span>
                          {(bill as any).autopay && <span className="px-1.5 py-0.5 bg-primary/15 text-primary rounded text-[10px] font-semibold shrink-0">autopay</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-base font-bold font-mono ${isPaid ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{formatMoney(bill.amount)}</div>
                      <div className={`text-xs mt-0.5 font-medium ${isPaid ? 'text-success' : isDanger ? 'text-destructive' : isWarn ? 'text-warning' : 'text-muted-foreground'}`}>
                        {isPaid ? 'paid this month' : days <= 0 ? `due ${dueText}` : `due in ${dueText}`}
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => startEdit(bill)} className="text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDeleteId(bill.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3"><CalendarDays className="w-4 h-4 text-primary" /> Bill summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Active bills</span><strong>{upcoming.length}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due in 7 days</span><strong className="text-warning">{upcoming.filter(b => nextDueDays(b.dueDay) <= 7 && (b as any).paidMonth !== currentMonthKey).length}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total / month</span><strong className="font-mono text-destructive">{formatMoney(getTotalFixed(upcoming))}</strong></div>
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="text-sm font-bold text-foreground mb-3">This month</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Paid</span>
                <div className="text-right">
                  <strong className="text-success font-mono">{formatMoney(paidAmount)}</strong>
                  <span className="text-xs text-muted-foreground ml-1">({paidCount} bill{paidCount !== 1 ? 's' : ''})</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Still owed</span>
                <strong className={`font-mono ${unpaidAmount > 0 ? 'text-warning' : 'text-success'}`}>{formatMoney(unpaidAmount)}</strong>
              </div>
              {upcoming.length > 0 && (
                <div className="pt-2 border-t border-border/20">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Payment progress</span>
                    <span>{paidCount} / {upcoming.length}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-success transition-all duration-500" style={{ width: `${upcoming.length > 0 ? (paidCount / upcoming.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
