import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
    async signIn({ user }) {
      if (!user.email) return false;

      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;

      // 初始管理員永遠允許登入
      if (user.email === initialAdminEmail) return true;

      // 其他使用者需在白名單中且啟用
      const allowedUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (!allowedUser || !allowedUser.isActive) return false;

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, id: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // 初始管理員首次登入時，PrismaAdapter 會自動建立 User，
      // 這裡把角色升級為 ADMIN
      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
      if (user.email === initialAdminEmail && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
