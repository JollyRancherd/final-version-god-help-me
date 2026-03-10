import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { api, buildUrl, type CreatePaycheckRequest } from "@shared/routes";

export function usePaychecks() {
  return useQuery({
    queryKey: [api.paychecks.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.paychecks.list.path);
      if (!res.ok) throw new Error("Failed to fetch paychecks");
      return api.paychecks.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePaycheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePaycheckRequest) => {
      const validated = api.paychecks.create.input.parse(data);
      const res = await apiFetch(api.paychecks.create.path, {
        method: api.paychecks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.paychecks.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to save paycheck");
      }
      return api.paychecks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.paychecks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
    },
  });
}

export function useDeletePaycheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.paychecks.delete.path, { id });
      const res = await apiFetch(url, { method: api.paychecks.delete.method });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete paycheck");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.paychecks.list.path] });
    },
  });
}
