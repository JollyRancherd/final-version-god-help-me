import React, { useState } from "react";
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from "@/hooks/use-accounts";
import { formatMoney } from "@/lib/budget-utils";
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";
import type { BankAccount } from "@shared/schema";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", icon: "🏦" },
  { value: "savings", label: "Savings", icon: "💰" },
  { value: "credit", label: "Credit Card", icon: "💳" },
  { value: "investment", label: "Investment", icon: "📈" },
  { value: "cash", label: "Cash", icon: "💵" },
];

const emptyForm = { name: "", type: "checking", balance: "", icon: "🏦", color: "hsl(var(--primary))", sortOrder: 0 };

export function AccountsSection() {
  const { data: accounts } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const totalBalance = (accounts || []).reduce((s, a) => {
    const b = Number(a.balance);
    return a.type === "credit" ? s - b : s + b;
  }, 0);
  const liquidCash = (accounts || []).filter(a => a.type === "checking" || a.type === "savings" || a.type === "cash").reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalDebt = (accounts || []).filter(a => a.type === "credit" || a.type === "loan").reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const startEdit = (a: BankAccount) => {
    setEditingId(a.id);
    setEditForm({ name: a.name, type: a.type, balance: Number(a.balance).toFixed(2), icon: a.icon, color: a.color, sortOrder: a.sortOrder });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateAccount.mutate({
      id: editingId,
      name: editForm.name,
      type: editForm.type,
      balance: parseFloat(editForm.balance || "0").toFixed(2),
      icon: editForm.icon,
    }, { onSuccess: () => { setEditingId(null); } });
  };

  const handleCreate = () => {
    createAccount.mutate({
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance || "0").toFixed(2),
      icon: ACCOUNT_TYPES.find(t => t.value === form.type)?.icon || "🏦",
      color: "hsl(var(--primary))",
      sortOrder: (accounts?.length || 0),
    }, { onSuccess: () => { setForm({ ...emptyForm }); setShowAdd(false); } });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm font-bold text-foreground">Accounts & Balances</div>
          <div className="text-xs text-muted-foreground mt-0.5">Track all your bank accounts and credit cards</div>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Account
        </button>
      </div>

      {(accounts?.length || 0) > 0 && (
        <>
          <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total net balance</span>
            <span className={`text-base font-bold font-mono ${totalBalance >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(totalBalance)}</span>
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs text-muted-foreground mb-1">Liquid cash</div><div className="text-lg font-bold font-mono text-foreground">{formatMoney(liquidCash)}</div></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs text-muted-foreground mb-1">Tracked debt</div><div className="text-lg font-bold font-mono text-destructive">{formatMoney(totalDebt)}</div></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs text-muted-foreground mb-1">Accounts added</div><div className="text-lg font-bold font-mono text-primary">{accounts?.length || 0}</div></div>
          </div>
        </>
      )}

      {showAdd && (
        <div className="mb-4 p-4 bg-white/5 border border-primary/20 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Account Name</label>
              <input
                type="text" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                placeholder="e.g. Chase Checking"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none">
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Current Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
              <input
                type="number" step="0.01" value={form.balance} onChange={e => setForm(v => ({ ...v, balance: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2 text-sm font-mono focus:border-primary outline-none"
              />
            </div>
            {form.type === "credit" && <p className="text-xs text-muted-foreground mt-1">Credit card balances are subtracted from your net total.</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.name || createAccount.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
              {createAccount.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-border text-muted-foreground rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(accounts || []).length === 0 && !showAdd && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No accounts yet — tap "Add Account" to track your balances.
          </div>
        )}
        {(accounts || []).map(a => (
          <div key={a.id} className="p-3 bg-white/5 border border-white/10 rounded-xl">
            {editingId === a.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editForm.name} onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))}
                    className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none" />
                  <select value={editForm.type} onChange={e => setEditForm(v => ({ ...v, type: e.target.value }))}
                    className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none">
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                  <input type="number" step="0.01" value={editForm.balance} onChange={e => setEditForm(v => ({ ...v, balance: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg pl-6 pr-3 py-1.5 text-sm font-mono focus:border-primary outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={updateAccount.isPending} className="px-3 py-1.5 bg-success text-success-foreground rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-border text-muted-foreground rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{a.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{ACCOUNT_TYPES.find(t => t.value === a.type)?.label || a.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-base font-bold font-mono ${a.type === "credit" ? "text-destructive" : "text-foreground"}`}>
                      {a.type === "credit" ? "-" : ""}{formatMoney(a.balance)}
                    </div>
                    {a.type === "credit" && <div className="text-[10px] text-muted-foreground">owed</div>}
                  </div>
                  {confirmDeleteId === a.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteAccount.mutate(a.id, { onSuccess: () => setConfirmDeleteId(null) })}
                        className="px-2 py-1 bg-destructive text-destructive-foreground rounded text-xs font-semibold">Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 border border-border text-foreground rounded text-xs">No</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(a)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(a.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
