import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
      if (user.email === initialAdminEmail) {
        // 查 DB 取 id（首次登入時 Adapter 已先建立 User）
        const adminUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        });
        if (adminUser) {
          await prisma.systemLog.create({
            data: {
              userId: adminUser.id,
              action: "USER_LOGIN",
              detail: user.email,
            },
          }).catch(() => {});
        }
        return true;
      }

      // 其他使用者需在白名單中且啟用
      const allowedUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (!allowedUser || !allowedUser.isActive) return false;

      await prisma.systemLog.create({
        data: {
          userId: allowedUser.id,
          action: "USER_LOGIN",
          detail: user.email,
        },
      }).catch(() => {});

      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@prisma/client").Role;
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
