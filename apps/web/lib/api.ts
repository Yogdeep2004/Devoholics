import type { Session } from "@supabase/supabase-js";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** FastAPI errors are a string, or an object like {message, errors: [{message}], report: {issues}}. */
export function describe(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const d = detail as { message?: string; detail?: string; errors?: { message: string }[]; report?: { issues?: { level: string; message: string }[] } };
    const list = d.errors?.map((e) => e.message) ?? d.report?.issues?.filter((i) => i.level === "error").map((i) => i.message) ?? [];
    const msg = d.message ?? fallback;
    return list.length ? `${msg}: ${list.join("; ")}` : msg;
  }
  return fallback;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method: opts.method ?? "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new ApiError(r.status, describe((await r.json().catch(() => ({}))).detail, r.statusText));
  return r.json();
}

export const tokenOf = (s: Session | null) => s?.access_token ?? null;
