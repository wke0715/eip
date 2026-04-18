import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// 僅限開發環境使用
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";

  const token = await encode({
    token: {
      name: user.name,
      email: user.email,
      picture: null,
      sub: user.id,
      id: user.id,
      role: user.role,
    },
    secret,
    maxAge: 60 * 60 * 8,
    salt: "authjs.session-token",
  });

  await prisma.systemLog.create({
    data: {
      userId: user.id,
      action: "USER_LOGIN",
      detail: user.email,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  }).catch(() => {});

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
