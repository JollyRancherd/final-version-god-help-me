export function exportToCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h] ?? "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedCSVRow {
  date: string;
  description: string;
  amount: number;
  rawLine: string;
}

function tryParseAmount(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s()]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

function tryParseDate(val: string): string {
  if (!val) return "";
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return val.trim();
}

export function parseBankCSV(csvText: string): ParsedCSVRow[] {
  const lines = csvText.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const dateIdx = headers.findIndex(h => h.includes("date") || h === "postingdate" || h === "transactiondate");
  const descIdx = headers.findIndex(h => h.includes("desc") || h.includes("memo") || h.includes("payee") || h.includes("merchant") || h.includes("name") || h.includes("detail"));
  const amtIdx = headers.findIndex(h => h === "amount" || h.includes("debit") || h.includes("withdrawal") || h === "amt");
  const creditIdx = headers.findIndex(h => h.includes("credit") || h.includes("deposit"));

  if (dateIdx === -1 || descIdx === -1) return [];

  const rows: ParsedCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const dateRaw = cols[dateIdx] || "";
    const desc = cols[descIdx] || "";
    let amount: number | null = null;

    if (amtIdx >= 0) {
      const v = tryParseAmount(cols[amtIdx] || "");
      if (v !== null && v > 0) amount = v;
    }
    if (amount === null && creditIdx >= 0) {
      const v = tryParseAmount(cols[creditIdx] || "");
      if (v !== null && v > 0) amount = v;
    }

    if (!desc || amount === null || amount <= 0) continue;

    rows.push({
      date: tryParseDate(dateRaw),
      description: desc,
      amount,
      rawLine: lines[i],
    });
  }

  return rows;
}
