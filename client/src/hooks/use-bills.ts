import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { api, buildUrl } from "@shared/routes";

export function useBills() {
  return useQuery({
    queryKey: [api.bills.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.bills.list.path);
      if (!res.ok) throw new Error("Failed to fetch bills");
      return api.bills.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof api.bills.create.input.parse>[0]) => {
      const validated = api.bills.create.input.parse(payload);
      const res = await apiFetch(api.bills.create.path, {
        method: api.bills.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create bill");
      return api.bills.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bills.list.path] }),
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Parameters<typeof api.bills.update.input.parse>[0] }) => {
      const validated = api.bills.update.input.parse(updates);
      const res = await apiFetch(buildUrl(api.bills.update.path, { id }), {
        method: api.bills.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to update bill");
      return api.bills.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bills.list.path] }),
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(buildUrl(api.bills.delete.path, { id }), {
        method: api.bills.delete.method,
      });
      if (!res.ok) throw new Error("Failed to delete bill");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bills.list.path] }),
  });
}
