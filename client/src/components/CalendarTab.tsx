import React, { useMemo, useState } from "react";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { useBills } from "@/hooks/use-bills";
import { useSettings } from "@/hooks/use-settings";
import { formatMoney, getBillDueDate, getUpcomingBills } from "@/lib/budget-utils";
import { CalendarDays, Clock3, Loader2, CheckCircle2 } from "lucide-react";

const currentMonthKey = new Date().toISOString().slice(0, 7);

export function CalendarTab() {
  const { data: bills, isLoading: billsLoading } = useBills();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const activeBills = useMemo(() => (bills || []).filter((bill) => bill.active !== false), [bills]);

  const paydayDate = useMemo(() => {
    if (!settings?.nextPayday) return null;
    return new Date(settings.nextPayday + "T12:00:00");
  }, [settings?.nextPayday]);

  const highlightedDates = useMemo(() => activeBills.map((bill) => getBillDueDate(bill.dueDay)), [activeBills]);

  const paidBillDates = useMemo(() =>
    activeBills
      .filter(b => (b as any).paidMonth === currentMonthKey)
      .map(b => getBillDueDate(b.dueDay)),
    [activeBills]
  );

  const selectedDayBills = useMemo(() => {
    if (!selectedDate) return [];
    return activeBills.filter((bill) => {
      const dueDate = getBillDueDate(bill.dueDay);
      return (
        dueDate.getFullYear() === selectedDate.getFullYear() &&
        dueDate.getMonth() === selectedDate.getMonth() &&
        dueDate.getDate() === selectedDate.getDate()
      );
    });
  }, [activeBills, selectedDate]);

  const isPayday = useMemo(() => {
    if (!paydayDate || !selectedDate) return false;
    return (
      paydayDate.getFullYear() === selectedDate.getFullYear() &&
      paydayDate.getMonth() === selectedDate.getMonth() &&
      paydayDate.getDate() === selectedDate.getDate()
    );
  }, [paydayDate, selectedDate]);

  const upcomingBills = useMemo(() => getUpcomingBills(activeBills, 21), [activeBills]);

  const paydayModifier = useMemo(() => paydayDate ? [paydayDate] : [], [paydayDate]);

  if (billsLoading || settingsLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-start gap-4 mb-5 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-primary">Bill calendar</h3>
            <p className="text-xs text-muted-foreground mt-1">See what is due soon and what day of the month looks dangerous.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            📅 Due-date map
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
          <div>
            <div className="glass-panel-soft p-3 overflow-x-auto mb-3">
              <MiniCalendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  billDue: highlightedDates,
                  billPaid: paidBillDates,
                  payday: paydayModifier,
                }}
                modifiersClassNames={{
                  billDue: "bg-primary/15 text-primary rounded-md font-bold border border-primary/30",
                  billPaid: "bg-success/20 text-success rounded-md font-bold border border-success/30",
                  payday: "bg-success/30 text-success rounded-md font-black ring-2 ring-success/50",
                }}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-4 px-1 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-primary/30 border border-primary/50 inline-block"></span> Bill due
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-success/30 border border-success/50 inline-block"></span> Bill paid
              </div>
              {paydayDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-sm bg-success/50 ring-1 ring-success inline-block"></span> 💰 Payday
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel-soft p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                <CalendarDays className="w-4 h-4 text-primary" /> Selected day
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </div>
              {isPayday && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-xs text-success font-semibold flex items-center gap-2">
                  💰 Payday!
                </div>
              )}
              {selectedDayBills.length === 0 && !isPayday ? (
                <p className="text-sm text-muted-foreground">No active bills are mapped to this date.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayBills.map((bill) => {
                    const isPaid = (bill as any).paidMonth === currentMonthKey;
                    return (
                      <div key={bill.id} className={`flex items-center justify-between gap-3 rounded-xl bg-background/60 border px-3 py-3 ${isPaid ? "border-success/30" : "border-white/5"}`}>
                        <div className="flex items-center gap-2">
                          {isPaid
                            ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            : <span className="text-base">{bill.icon}</span>}
                          <div>
                            <div className={`text-sm font-bold ${isPaid ? "text-success line-through" : "text-foreground"}`}>{bill.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{isPaid ? "Paid this month" : bill.note || "Recurring bill"}</div>
                          </div>
                        </div>
                        <div className={`text-sm font-mono font-bold ${isPaid ? "text-success line-through" : "text-foreground"}`}>{formatMoney(bill.amount)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel-soft p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                <Clock3 className="w-4 h-4 text-warning" /> Next 21 days
              </div>
              <div className="space-y-2">
                {upcomingBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active bills coming up.</p>
                ) : (
                  upcomingBills.map(({ bill, dueDate, daysUntil }) => {
                    const isPaid = (bill as any).paidMonth === currentMonthKey;
                    return (
                      <div key={bill.id} className={`flex items-center justify-between gap-3 rounded-xl bg-background/60 border px-3 py-3 ${isPaid ? "border-success/20" : "border-white/5"}`}>
                        <div className="flex items-center gap-2">
                          {isPaid
                            ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            : <span className="text-base">{bill.icon}</span>}
                          <div>
                            <div className={`text-sm font-semibold ${isPaid ? "text-muted-foreground line-through" : "text-foreground"}`}>{bill.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {isPaid ? "paid ✓" : daysUntil === 0 ? "today" : `${daysUntil}d`}
                            </div>
                          </div>
                        </div>
                        <div className={`text-sm font-mono font-bold ${isPaid ? "text-success" : "text-foreground"}`}>{formatMoney(bill.amount)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
