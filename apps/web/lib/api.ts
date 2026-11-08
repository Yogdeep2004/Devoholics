import type { Session } from "@supabase/supabase-js";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method: opts.method ?? "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new ApiError(r.status, (await r.json().catch(() => ({}))).detail ?? r.statusText);
  return r.json();
}

export const tokenOf = (s: Session | null) => s?.access_token ?? null;
