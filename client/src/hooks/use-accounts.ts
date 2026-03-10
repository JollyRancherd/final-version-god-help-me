import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { api } from "@shared/routes";
import type { BankAccount } from "@shared/schema";

export function useAccounts() {
  return useQuery<BankAccount[]>({
    queryKey: ["/api/accounts"],
    queryFn: async () => {
      const res = await apiFetch(api.accounts.list.path);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<BankAccount, "id" | "userId">) => {
      const res = await apiFetch(api.accounts.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BankAccount> & { id: number }) => {
      const res = await apiFetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/accounts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/accounts"] }),
  });
}
