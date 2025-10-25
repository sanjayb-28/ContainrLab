import { apiGet, apiPost } from "@/lib/api";

export type AuthUser = {
  user_id: string;
  email: string;
  created_at: string;
  last_login_at: string;
};

export type LoginResponse = AuthUser & {
  token: string;
};

export async function requestLogin(email: string): Promise<LoginResponse> {
  const payload = await apiPost<LoginResponse>("/auth/login", { email });
  return payload;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me", { token });
}
