import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { api, buildUrl, type CreateExpenseRequest } from "@shared/routes";
import { z } from "zod";

export function useExpenses() {
  return useQuery({
    queryKey: [api.expenses.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.expenses.list.path);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return api.expenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateExpenseRequest) => {
      const validated = api.expenses.create.input.parse(data);
      const res = await apiFetch(api.expenses.create.path, {
        method: api.expenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.expenses.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create expense");
      }
      return api.expenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.expenses.delete.path, { id });
      const res = await apiFetch(url, { method: api.expenses.delete.method });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete expense");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
    },
  });
}

export function useResetExpenses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch(api.expenses.reset.path, {
        method: api.expenses.reset.method,
      });
      if (!res.ok) throw new Error("Failed to reset expenses");
      return api.expenses.reset.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.snapshots.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.bills.list.path] });
    },
  });
}

export function useMonthlySnapshots() {
  return useQuery({
    queryKey: [api.snapshots.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.snapshots.list.path);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return api.snapshots.list.responses[200].parse(await res.json());
    },
  });
}
