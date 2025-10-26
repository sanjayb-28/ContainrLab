import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { exchangeOAuthLogin } from "@/lib/auth";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, trigger }) {
      if (account?.provider === "github") {
        const email = user?.email ?? token.email;
        if (!email) {
          throw new Error("GitHub account did not return an email. Enable email access in your GitHub OAuth app.");
        }
        const providerAccountId = account.providerAccountId ?? token.providerAccountId;
        if (!providerAccountId) {
          throw new Error("GitHub account did not include an account identifier.");
        }

        const response = await exchangeOAuthLogin({
          provider: "github",
          provider_account_id: providerAccountId,
          email,
          name: user?.name ?? token.name ?? null,
          avatar_url: (user as { image?: string } | undefined)?.image ?? (token.avatar_url as string | undefined) ?? null,
        });

        token.backendToken = response.token;
        token.backendUserId = response.user_id;
        token.backendCreatedAt = response.created_at;
        token.backendLastLoginAt = response.last_login_at;
        token.email = response.email;
        token.name = response.name;
        token.avatar_url = response.avatar_url;
        token.providerAccountId = providerAccountId;
      } else if (trigger === "signIn" && !token.backendToken) {
        throw new Error("GitHub login did not return provider metadata.");
      }

      return token;
    },
    async session({ session, token }) {
      session.backendToken = typeof token.backendToken === "string" ? token.backendToken : undefined;
      session.backendUserId = typeof token.backendUserId === "string" ? token.backendUserId : undefined;
      session.backendCreatedAt =
        typeof token.backendCreatedAt === "string" ? token.backendCreatedAt : undefined;
      session.backendLastLoginAt =
        typeof token.backendLastLoginAt === "string" ? token.backendLastLoginAt : undefined;

      if (session.user) {
        session.user.email = token.email ?? session.user.email ?? undefined;
        session.user.name = (token.name as string | undefined) ?? session.user.name ?? undefined;
        session.user.id = typeof token.backendUserId === "string" ? token.backendUserId : session.user.id;
        session.user.image = (token.avatar_url as string | undefined) ?? session.user.image ?? undefined;
      }

      return session;
    },
  },
});

export { handler as GET, handler as POST };
