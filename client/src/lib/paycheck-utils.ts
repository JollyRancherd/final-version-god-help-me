export type PaycheckLineItem = {
  id: string;
  name: string;
  category: 'tax' | 'deduction';
  amount: number;
};

export type ParsedPaycheck = {
  id: number;
  payDate: string;
  grossPay: number;
  netPay: number;
  taxesTotal: number;
  deductionsTotal: number;
  note: string;
  lineItems: PaycheckLineItem[];
};

export function parsePaycheckRows(rows: any[] | undefined | null): ParsedPaycheck[] {
  return (rows || []).map((row) => ({
    id: Number(row.id),
    payDate: row.payDate,
    grossPay: Number(row.grossPay || 0),
    netPay: Number(row.netPay || 0),
    taxesTotal: Number(row.taxesTotal || 0),
    deductionsTotal: Number(row.deductionsTotal || 0),
    note: row.note || '',
    lineItems: safeParseLineItems(row.lineItems),
  })).sort((a, b) => (b.payDate || '').localeCompare(a.payDate || ''));
}

export function safeParseLineItems(input: string | null | undefined): PaycheckLineItem[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => ({
      id: String(item.id || index),
      name: String(item.name || 'Line item'),
      category: item.category === 'deduction' ? 'deduction' : 'tax',
      amount: Number(item.amount || 0),
    })).filter((item) => item.amount >= 0);
  } catch {
    return [];
  }
}

export function summarizeLineItems(items: PaycheckLineItem[]) {
  const taxesTotal = items.filter((item) => item.category === 'tax').reduce((sum, item) => sum + item.amount, 0);
  const deductionsTotal = items.filter((item) => item.category === 'deduction').reduce((sum, item) => sum + item.amount, 0);
  return {
    taxesTotal,
    deductionsTotal,
    totalWithheld: taxesTotal + deductionsTotal,
  };
}

export function analyzePaycheckHistory(rows: ParsedPaycheck[]) {
  if (!rows.length) {
    return {
      averageGross: 0,
      averageNet: 0,
      averageTaxRate: 0,
      averageDeductionRate: 0,
      commonLineItems: [] as Array<{ name: string; category: 'tax' | 'deduction'; averageAmount: number; hitRate: number }>,
    };
  }

  const totals = rows.reduce((acc, row) => {
    acc.gross += row.grossPay;
    acc.net += row.netPay;
    acc.tax += row.taxesTotal;
    acc.deduction += row.deductionsTotal;
    return acc;
  }, { gross: 0, net: 0, tax: 0, deduction: 0 });

  const byName = new Map<string, { name: string; category: 'tax' | 'deduction'; total: number; count: number }>();
  rows.forEach((row) => {
    row.lineItems.forEach((item) => {
      const key = `${item.category}:${item.name.toLowerCase()}`;
      const current = byName.get(key) || { name: item.name, category: item.category, total: 0, count: 0 };
      current.total += item.amount;
      current.count += 1;
      byName.set(key, current);
    });
  });

  const commonLineItems = [...byName.values()]
    .filter((item) => item.count >= Math.max(2, Math.ceil(rows.length / 2)))
    .map((item) => ({
      name: item.name,
      category: item.category,
      averageAmount: item.total / item.count,
      hitRate: item.count / rows.length,
    }))
    .sort((a, b) => b.hitRate - a.hitRate || b.averageAmount - a.averageAmount);

  const averageGross = totals.gross / rows.length;
  return {
    averageGross,
    averageNet: totals.net / rows.length,
    averageTaxRate: averageGross > 0 ? totals.tax / totals.gross : 0,
    averageDeductionRate: averageGross > 0 ? totals.deduction / totals.gross : 0,
    commonLineItems,
  };
}

export function estimateTakeHomeFromHistory(grossPay: number, rows: ParsedPaycheck[]) {
  const summary = analyzePaycheckHistory(rows);
  const estimatedTaxes = grossPay * summary.averageTaxRate;
  const estimatedDeductions = grossPay * summary.averageDeductionRate;
  return {
    estimatedTaxes,
    estimatedDeductions,
    estimatedNet: Math.max(0, grossPay - estimatedTaxes - estimatedDeductions),
    summary,
  };
}
