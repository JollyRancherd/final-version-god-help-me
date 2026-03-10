import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type UpdateSettingsRequest } from "@shared/routes";
import { z } from "zod";
import { apiFetch } from "@/lib/api-fetch";

export function useSettings() {
  return useQuery({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await apiFetch(api.settings.get.path);
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      return api.settings.get.responses[200].parse(data);
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: UpdateSettingsRequest) => {
      // Validate partial payload before sending
      const validated = api.settings.update.input.parse(updates);
      const res = await apiFetch(api.settings.update.path, {
        method: api.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.settings.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to update settings");
      }
      return api.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
    },
  });
}
