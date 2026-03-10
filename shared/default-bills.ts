export interface DefaultBillSeed {
  name: string;
  amount: number;
  icon: string;
  note: string;
  dueDay: number;
}

export const DEFAULT_FIXED_BILLS: DefaultBillSeed[] = [];
