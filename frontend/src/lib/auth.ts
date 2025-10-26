import { apiGet, apiPost } from "@/lib/api";

export type AuthUser = {
  user_id: string;
  email: string;
  created_at: string;
  last_login_at: string;
  name?: string;
  avatar_url?: string;
};

export type LoginResponse = AuthUser & {
  token: string;
};

export type OAuthLoginRequest = {
  provider: "github";
  provider_account_id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
};

export async function exchangeOAuthLogin(request: OAuthLoginRequest): Promise<LoginResponse> {
  const payload = await apiPost<LoginResponse>(`/auth/oauth/${request.provider}`, request);
  return payload;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me", { token });
}
