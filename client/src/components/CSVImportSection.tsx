import React, { useState, useRef } from "react";
import { parseBankCSV, type ParsedCSVRow } from "@/lib/csv-utils";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useSettings } from "@/hooks/use-settings";
import { getAllocs } from "@/lib/budget-utils";
import { Upload, CheckCircle2, Loader2, X } from "lucide-react";

export function CSVImportSection() {
  const { data: settings } = useSettings();
  const createExpense = useCreateExpense();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<(ParsedCSVRow & { allocId: string; skip: boolean })[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const phase = settings?.phase || 1;
  const overridesJson = (settings as any)?.allocOverrides;
  const namesJson = (settings as any)?.allocNames;
  const allocs = getAllocs(phase, overridesJson, namesJson).filter(a => a.recommended > 0);
  const defaultAllocId = allocs[0]?.id || "groceries";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setDone(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setError("Please select a CSV file."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseBankCSV(text);
      if (parsed.length === 0) {
        setError("Could not parse this CSV. Make sure it has Date, Description, and Amount columns.");
        return;
      }
      setRows(parsed.map(r => ({ ...r, allocId: defaultAllocId, skip: false })));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => !r.skip);
    if (toImport.length === 0) return;
    setImporting(true);
    for (const row of toImport) {
      await new Promise<void>(resolve => {
        createExpense.mutate({
          name: row.description.slice(0, 60),
          amount: row.amount.toFixed(2),
          allocId: row.allocId,
          date: row.date,
        }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    setImporting(false);
    setDone(true);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-bold text-foreground">Import from Bank CSV</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Download a statement from your bank and upload it here. Supports Chase, Bank of America, Wells Fargo, and most standard CSV exports.
        </p>
      </div>

      {done ? (
        <div className="p-4 bg-success/10 border border-success/30 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <div>
            <div className="text-sm font-semibold text-success">Import complete!</div>
            <div className="text-xs text-muted-foreground mt-0.5">Your transactions have been added to the expense log.</div>
          </div>
          <button onClick={() => setDone(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      ) : rows.length === 0 ? (
        <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">Tap to choose a CSV file</div>
            <div className="text-xs text-muted-foreground mt-1">Your file stays on-device — nothing is sent externally</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{rows.filter(r => !r.skip).length} of {rows.length} transactions selected</span>
            <button onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={i} className={`p-3 rounded-xl border transition-opacity ${r.skip ? "opacity-40 border-white/5" : "border-white/10"} bg-white/5`}>
                <div className="flex items-start gap-2 mb-2">
                  <input type="checkbox" checked={!r.skip} onChange={e => setRows(prev => prev.map((row, j) => j === i ? { ...row, skip: !e.target.checked } : row))}
                    className="accent-primary mt-0.5 w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{r.description}</div>
                    <div className="text-xs text-muted-foreground">{r.date} · <span className="font-mono font-bold text-foreground">${r.amount.toFixed(2)}</span></div>
                  </div>
                </div>
                {!r.skip && (
                  <select
                    value={r.allocId}
                    onChange={e => setRows(prev => prev.map((row, j) => j === i ? { ...row, allocId: e.target.value } : row))}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs focus:border-primary outline-none"
                  >
                    {allocs.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={importing || rows.filter(r => !r.skip).length === 0}
            className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? "Importing..." : `Import ${rows.filter(r => !r.skip).length} transactions`}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
