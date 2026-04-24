import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const e2eSecret = process.env.E2E_SECRET;
  if (!e2eSecret) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const userId = searchParams.get("userId");

  if (secret !== e2eSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const authSecret =
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
  const isHttps = new URL(request.url).protocol === "https:";
  // Auth.js v5 在 HTTPS 環境使用 __Secure- 前綴的 cookie 名稱與 salt
  const cookieName = isHttps
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      name: user.name,
      email: user.email,
      picture: null,
      sub: user.id,
      id: user.id,
      role: user.role,
    },
    secret: authSecret,
    maxAge: 60 * 60 * 8,
    salt: cookieName,
  });

  const publicBase =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/", publicBase));
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
