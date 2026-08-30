export async function req<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${r.status} ${r.statusText}`);
  }
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
}

export const post = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => req<void>(path, { method: 'DELETE' });

export type User = {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

export type Bank = {
  id: number;
  name: string;
  sender_email: string;
  sender_domain: string;
  subject_monthly: string;
  subject_ondemand: string;
  attachment_filename_pattern: string;
  parser_key: string;
  is_active: boolean;
};

export type EmailAccount = { id: number; email: string; last_synced_at: string | null };

export type Account = {
  id: number;
  nickname: string;
  account_number: string;
  promptpay_id: string | null;
  bank_id: number;
  bank_name: string;
  email_account_id: number;
  email: string;
};
