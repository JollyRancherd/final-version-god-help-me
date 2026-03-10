import { DEFAULT_FIXED_BILLS as SHARED_DEFAULT_BILLS } from "@shared/default-bills";

export const TOTAL_DEBT = 1226.37;
export const BUFFER = 300;
export const APARTMENT_GOAL = 3000;
export const EMERGENCY_GOAL = 1000;

export interface Bill {
  id?: string | number;
  name: string;
  amount: number;
  icon: string;
  note: string;
  dueDay: number;
  active?: boolean;
}

export const DEFAULT_FIXED_BILLS: Bill[] = SHARED_DEFAULT_BILLS.map((bill, index) => ({
  id: `${index + 1}`,
  ...bill,
  active: true,
}));

export interface Allocation {
  id: string;
  name: string;
  recommended: number;
  color: string;
  icon: string;
  note: string;
}

export const PHASE1_ALLOCS: Allocation[] = [
  { id: "debt", name: "Debt Payoff", recommended: 400, color: "hsl(var(--destructive))", icon: "💳", note: "Final push — gone by ~March 20" },
  { id: "emergency", name: "Emergency Fund", recommended: 150, color: "hsl(var(--primary))", icon: "🛡️", note: "Target: $1,000" },
  { id: "groceries", name: "Groceries", recommended: 300, color: "hsl(var(--warning))", icon: "🛒", note: "Your estimate" },
  { id: "gas", name: "Gas", recommended: 35, color: "hsl(var(--warning))", icon: "⛽", note: "~1 tank/month" },
  { id: "entertainment", name: "Fun Money", recommended: 100, color: "hsl(var(--accent))", icon: "🎉", note: "You deserve some" },
  { id: "savings", name: "Savings", recommended: 0, color: "hsl(var(--success))", icon: "💰", note: "Paused — starts Phase 2" },
  { id: "apartment", name: "Savings Fund", recommended: 0, color: "hsl(var(--warning))", icon: "💰", note: "Starts after debt is gone" },
  { id: "taxes", name: "Taxes / IRS", recommended: 0, color: "hsl(var(--muted-foreground))", icon: "🏛️", note: "Set an amount to reserve for taxes" },
  { id: "misc", name: "Other / Flexible", recommended: 0, color: "hsl(var(--primary))", icon: "📦", note: "Rename this to whatever you need" },
];

export const PHASE2_ALLOCS: Allocation[] = [
  { id: "apartment", name: "Savings Fund", recommended: 600, color: "hsl(var(--warning))", icon: "💰", note: "Goal: $3,000 by Nov/Dec 2026" },
  { id: "emergency", name: "Emergency Fund", recommended: 300, color: "hsl(var(--primary))", icon: "🛡️", note: "Build to $3,000 long term" },
  { id: "savings", name: "General Savings", recommended: 200, color: "hsl(var(--success))", icon: "💰", note: "Long-term wealth building" },
  { id: "groceries", name: "Groceries", recommended: 300, color: "hsl(var(--warning))", icon: "🛒", note: "Food + basics" },
  { id: "gas", name: "Gas", recommended: 35, color: "hsl(var(--warning))", icon: "⛽", note: "Driving cushion" },
  { id: "mom", name: "Family / Give Back", recommended: 500, color: "hsl(var(--destructive))", icon: "❤️", note: "Optional once stable" },
  { id: "entertainment", name: "Fun Money", recommended: 150, color: "hsl(var(--accent))", icon: "🎉", note: "You earned this!" },
  { id: "taxes", name: "Taxes / IRS", recommended: 0, color: "hsl(var(--muted-foreground))", icon: "🏛️", note: "Set an amount to reserve for taxes" },
  { id: "misc", name: "Other / Flexible", recommended: 0, color: "hsl(var(--primary))", icon: "📦", note: "Rename this to whatever you need" },
];
