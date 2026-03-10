import React, { useState, useMemo } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useExpenses, useDeleteExpense, useMonthlySnapshots } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { formatMoney, getAllocs, getSpentByAlloc, getSpentThisMonth, getArchiveReportSummary } from "@/lib/budget-utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trash2, Download, History, Search, X, AlertTriangle } from "lucide-react";

type HistoryView = "current" | "past";

export function HistoryTab() {
  const { data: settings } = useSettings();
  const { data: expenses } = useExpenses();
  const { data: snapshots } = useMonthlySnapshots();
  const deleteExpense = useDeleteExpense();
  const { toast } = useToast();
  const [view, setView] = useState<HistoryView>("current");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const overridesJson = (settings as any)?.allocOverrides;
  const namesJson = (settings as any)?.allocNames;
  const allAllocs = [
    ...getAllocs(1, overridesJson, namesJson),
    ...getAllocs(2, overridesJson, namesJson).filter(a2 => !getAllocs(1).some(a1 => a1.id === a2.id))
  ];
  const total = getSpentThisMonth(expenses || []);
  const spentByAlloc = getSpentByAlloc(expenses || []);

  const chartData = allAllocs
    .filter(a => spentByAlloc[a.id] > 0)
    .map(a => ({ name: a.name.replace(" Fund", "").replace(" Money", ""), amount: spentByAlloc[a.id], color: a.color }));

  const filteredExpenses = useMemo(() => {
    const all = [...(expenses || [])].reverse();
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.allocId.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const handleExport = () => {
    if (!expenses || expenses.length === 0) {
      toast({ title: "Nothing to export", description: "Log some expenses first.", variant: "destructive" });
      return;
    }
    const headers = ["Date", "Name", "Category", "Amount"];
    const rows = expenses.map(e => [
      e.date,
      `"${e.name.replace(/"/g, '""')}"`,
      e.allocId,
      Number(e.amount).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} saved as CSV.` });
  };

  const handleDelete = (id: number, name: string) => {
    deleteExpense.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        toast({ title: "Expense removed", description: `"${name}" has been deleted.` });
      }
    });
  };

  const sortedSnapshots = [...(snapshots || [])].sort((a, b) => b.month.localeCompare(a.month));
  const archiveSummary = useMemo(() => getArchiveReportSummary(sortedSnapshots as any, allAllocs as any), [sortedSnapshots, allAllocs]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-2 flex gap-1">
        <button
          onClick={() => setView("current")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view === "current" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          This Cycle
        </button>
        <button
          onClick={() => setView("past")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${view === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <History className="w-3.5 h-3.5" />
          Past Months {sortedSnapshots.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{sortedSnapshots.length}</span>}
        </button>
      </div>

      {view === "current" && (
        <>
          <div className="glass-panel p-6 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Expense history</h3>
              <p className="text-xs text-muted-foreground mt-1">{(expenses || []).length} entries logged</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-white/5 text-foreground text-xs font-semibold border border-white/10 flex items-center gap-2">
                🧾 Total <span className="font-mono text-primary">{formatMoney(total)}</span>
              </span>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="glass-panel p-6">
              <h3 className="text-sm font-bold text-foreground mb-1">Spending by category</h3>
              <p className="text-xs text-muted-foreground mb-5">How much went where this cycle</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    formatter={(value: number) => [formatMoney(value), "Spent"]}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(!expenses || expenses.length === 0) ? (
            <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm font-semibold text-foreground mb-2">No expenses yet</div>
              <p className="text-xs text-muted-foreground max-w-[200px]">Head to the Log tab and start tracking.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search expenses..."
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-primary transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {filteredExpenses.length === 0 && search && (
                <div className="glass-panel p-8 text-center">
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="text-sm font-semibold text-foreground mb-1">No results for "{search}"</div>
                  <p className="text-xs text-muted-foreground">Try a different name or category.</p>
                </div>
              )}

              <div className="space-y-2">
                {filteredExpenses.map(e => {
                  const alloc = allAllocs.find(a => a.id === e.allocId) || { color: "hsl(var(--muted))", icon: "📝" };
                  const isConfirmingDelete = confirmDeleteId === e.id;
                  return (
                    <div key={e.id} className="glass-panel p-4 transition-colors hover:bg-white/[0.02] group">
                      {isConfirmingDelete ? (
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">Delete "{e.name}"?</p>
                            <p className="text-xs text-muted-foreground mt-0.5 mb-2">{formatMoney(e.amount)} · {e.date}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleDelete(e.id, e.name)} disabled={deleteExpense.isPending} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-semibold disabled:opacity-50">
                                {deleteExpense.isPending ? "Deleting..." : "Yes, Delete"}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 border border-border text-foreground rounded-lg text-xs">Cancel</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-bold text-foreground flex items-center gap-2">
                              <span>{alloc.icon}</span> {e.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {e.date} · <span className="uppercase tracking-wider opacity-70 text-[10px]">{e.allocId}</span>
                            </div>
                            {(e as any).note && (
                              <div className="text-xs text-muted-foreground/70 italic mt-0.5">{(e as any).note}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-base font-bold font-mono" style={{ color: alloc.color }}>
                              -{formatMoney(e.amount)}
                            </div>
                            <button
                              onClick={() => setConfirmDeleteId(e.id)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {view === "past" && (
        <>
          {sortedSnapshots.length === 0 ? (
            <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="text-sm font-semibold text-foreground mb-2">No past months yet</div>
              <p className="text-xs text-muted-foreground max-w-[220px]">After you complete a monthly reset or New Paycheck, your previous month's data will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="glass-panel p-5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Average month</div>
                  <div className="text-xl font-bold font-mono text-foreground mt-2">{formatMoney(archiveSummary.averageSpend)}</div>
                </div>
                <div className="glass-panel p-5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Best month</div>
                  <div className="text-sm font-semibold text-foreground mt-2">{archiveSummary.bestMonth?.month || '--'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{archiveSummary.bestMonth ? formatMoney(archiveSummary.bestMonth.totalSpent) : 'No data yet'}</div>
                </div>
                <div className="glass-panel p-5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Highest month</div>
                  <div className="text-sm font-semibold text-foreground mt-2">{archiveSummary.worstMonth?.month || '--'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{archiveSummary.worstMonth ? formatMoney(archiveSummary.worstMonth.totalSpent) : 'No data yet'}</div>
                </div>
                <div className="glass-panel p-5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent change</div>
                  <div className={`text-xl font-bold font-mono mt-2 ${archiveSummary.trendDelta !== null && archiveSummary.trendDelta <= 0 ? "text-success" : "text-foreground"}`}>{archiveSummary.trendDelta === null ? "--" : `${archiveSummary.trendDelta > 0 ? "+" : ""}${formatMoney(archiveSummary.trendDelta)}`}</div>
                  <div className="text-xs text-muted-foreground mt-1">Compared with the month before it</div>
                </div>
              </div>

              {archiveSummary.reports.length > 0 && (
                <div className="glass-panel p-6">
                  <h3 className="text-sm font-bold text-foreground mb-1">Monthly archive report</h3>
                  <p className="text-xs text-muted-foreground mb-4">Quick read of each saved month before you dive into the breakdown.</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {[...archiveSummary.reports].reverse().map((report) => (
                      <div key={report.month} className="rounded-2xl border border-white/10 bg-background/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{report.monthLabel}</div>
                            <div className="text-xs text-muted-foreground mt-1">Top category: {report.topCategory}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-bold text-primary">{formatMoney(report.totalSpent)}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">{report.categoriesUsed} categories used</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">Top category amount: {formatMoney(report.topAmount)}{report.savedAt ? ` · archived ${new Date(report.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sortedSnapshots.length >= 2 && (
                <div className="glass-panel p-6">
                  <h3 className="text-sm font-bold text-foreground mb-1">Spending trend</h3>
                  <p className="text-xs text-muted-foreground mb-4">Total spent per cycle over time</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={[...sortedSnapshots].reverse().map(s => ({
                      name: new Date(s.month + "-01T12:00:00").toLocaleDateString("en-US", { month: "short" }),
                      amount: Number(s.totalSpent)
                    }))} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={(v: number) => [formatMoney(v), "Spent"]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {sortedSnapshots.map(snap => {
                const breakdown: Record<string, number> = JSON.parse(snap.breakdown || "{}");
                const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
                const chartEntries = breakdownEntries
                  .filter(([id]) => allAllocs.some(a => a.id === id))
                  .map(([id, amount]) => {
                    const alloc = allAllocs.find(a => a.id === id)!;
                    return { name: alloc.name.replace(" Fund", "").replace(" Money", ""), amount, color: alloc.color };
                  });
                const month = new Date(snap.month + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
                return (
                  <div key={snap.id} className="glass-panel p-6">
                    <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                      <div>
                        <div className="text-sm font-bold text-foreground">{month}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Archived {new Date(snap.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-bold font-mono text-foreground">{formatMoney(snap.totalSpent)}</div>
                        <button
                          onClick={() => {
                            const breakdown: Record<string, number> = JSON.parse(snap.breakdown || "{}");
                            const rows = Object.entries(breakdown).map(([id, amount]) => {
                              const alloc = allAllocs.find(a => a.id === id);
                              return [snap.month, alloc?.name || id, Number(amount).toFixed(2)].join(",");
                            });
                            const csv = ["Month,Category,Amount", ...rows].join("\n");
                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `history-${snap.month}.csv`; a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                          }}
                          className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> CSV
                        </button>
                      </div>
                    </div>
                    {chartEntries.length > 0 && (
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={chartEntries} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                          <Tooltip formatter={(v: number) => [formatMoney(v), "Spent"]} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {chartEntries.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {breakdownEntries.slice(0, 4).map(([id, amount]) => {
                        const alloc = allAllocs.find(a => a.id === id);
                        if (!alloc) return null;
                        return (
                          <div key={id} className="glass-panel-soft p-2.5 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5"><span>{alloc.icon}</span> {alloc.name.replace(" Fund", "").replace(" Money", "")}</span>
                            <span className="text-xs font-mono font-semibold" style={{ color: alloc.color }}>{formatMoney(amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
