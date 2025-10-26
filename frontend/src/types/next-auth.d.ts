import NextAuth, { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    backendToken?: string;
    backendUserId?: string;
    backendCreatedAt?: string;
    backendLastLoginAt?: string;
    user?: DefaultSession["user"] & {
      id?: string;
    };
  }

  interface User {
    id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    backendToken?: string;
    backendUserId?: string;
    backendCreatedAt?: string;
    backendLastLoginAt?: string;
    name?: string;
    avatar_url?: string;
    providerAccountId?: string;
  }
}
