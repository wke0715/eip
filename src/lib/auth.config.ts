import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// 這個 config 不含 Prisma adapter，專門給 middleware（Edge Runtime）用
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token }) {
      // middleware 只傳遞 token，不查 DB
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@prisma/client").Role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      if (pathname === "/login" || pathname.startsWith("/api/auth")) {
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      return true;
    },
  },
};
