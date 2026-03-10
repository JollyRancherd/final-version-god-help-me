import type { RecurringBill } from "@shared/schema";

const PREF_KEY = "budget_bill_reminders_enabled";

export function getNotificationPref(): boolean {
  return localStorage.getItem(PREF_KEY) === "true";
}

export function setNotificationPref(val: boolean) {
  localStorage.setItem(PREF_KEY, val ? "true" : "false");
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function checkAndNotifyBills(bills: RecurringBill[]) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!getNotificationPref()) return;

  const today = new Date();
  const currentDay = today.getDate();

  const dueSoon = bills.filter(b => {
    if (!b.active || b.paidMonth) return false;
    const daysUntilDue = b.dueDay - currentDay;
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  });

  dueSoon.forEach(b => {
    const daysLeft = b.dueDay - currentDay;
    const dayLabel = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    new Notification(`${b.icon} ${b.name} due ${dayLabel}`, {
      body: `$${Number(b.amount).toFixed(2)} — tap to open your budget app`,
      tag: `bill-${b.id}`,
      icon: "/icon.png",
    });
  });
}
