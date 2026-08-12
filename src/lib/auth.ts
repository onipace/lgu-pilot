import { prisma, verifyPassword } from "@/lib/prisma";
import crypto from "crypto";

export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  role: "super_admin" | "lgu_admin";
  lgu_id: string | null;
  province_id: string | null;
  isActive: boolean;
}

export interface AuthSession {
  id: string;
  user: AdminUser;
  expires_at: string;
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.adminSession.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  return sessionId;
}

export async function validateSession(
  sessionId: string
): Promise<AuthSession | null> {
  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  return {
    id: session.id,
    user: {
      id: session.user.id,
      username: session.user.username,
      display_name: session.user.displayName,
      role: session.user.role as "super_admin" | "lgu_admin",
      lgu_id: session.user.lguId,
      province_id: session.user.provinceId,
      isActive: session.user.isActive,
    },
    expires_at: session.expiresAt.toISOString(),
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.adminSession.delete({ where: { id: sessionId } });
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const user = await prisma.adminUser.findFirst({
    where: { username, isActive: true },
  });

  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  // Update last login
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    role: user.role as "super_admin" | "lgu_admin",
    lgu_id: user.lguId,
    province_id: user.provinceId,
    isActive: user.isActive,
  };
}

export async function getSessionFromRequest(
  request: Request
): Promise<AuthSession | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionId = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("esangguni_session="))
    ?.split("=")[1];

  if (!sessionId) return null;
  return validateSession(sessionId);
}

export async function requireAuth(
  request: Request,
  requiredRole?: "super_admin"
): Promise<AuthSession> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }
  if (requiredRole === "super_admin" && session.user.role !== "super_admin") {
    throw new AuthError("Forbidden: Super admin access required", 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
