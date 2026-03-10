import { supabase } from "./supabase";

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  if (!(init?.body instanceof FormData)) {
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
  }

  return fetch(input, { ...init, headers });
}
