import crypto from "crypto";
import { prisma, hashPassword, verifyPassword } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════
// USER AUTH — Registration, login, and session management
// Separate from admin auth (admin_users / admin_sessions)
// ═══════════════════════════════════════════════════════════

const USER_SESSION_COOKIE = "esangguni_user_session";
const USER_SESSION_HOURS = 1;
const USER_SESSION_MS = USER_SESSION_HOURS * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  lgu_name: string;
  lgu_type: string | null;
  lgu_class: string | null;
  province: string;
  mobile_phone: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  approved_at: string | null;
  login_count: number;
  created_at: string;
}

export interface UserSession {
  id: string;
  user: UserProfile;
  expires_at: string;
}

export interface RegistrationInput {
  email: string;
  password: string;
  full_name: string;
  lgu_name: string;
  lgu_type?: string;
  lgu_class?: string;
  province: string;
  mobile_phone?: string;
}

export class UserAuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
    public code: string = "AUTH_ERROR"
  ) {
    super(message);
    this.name = "UserAuthError";
  }
}

// ── Helpers ────────────────────────────────────────────────

function toUserProfile(u: {
  id: string;
  email: string;
  fullName: string;
  lguName: string;
  lguType: string | null;
  lguClass: string | null;
  province: string;
  mobilePhone: string | null;
  status: string;
  rejectionReason: string | null;
  approvedAt: Date | null;
  loginCount: number;
  createdAt: Date;
}): UserProfile {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    lgu_name: u.lguName,
    lgu_type: u.lguType,
    lgu_class: u.lguClass,
    province: u.province,
    mobile_phone: u.mobilePhone,
    status: u.status as "pending" | "approved" | "rejected",
    rejection_reason: u.rejectionReason,
    approved_at: u.approvedAt?.toISOString() ?? null,
    login_count: u.loginCount,
    created_at: u.createdAt.toISOString(),
  };
}

// ── Registration ───────────────────────────────────────────

export async function registerUser(
  input: RegistrationInput
): Promise<{ id: string; email: string }> {
  // Validate email format
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new UserAuthError(
      "Valid email address is required",
      400,
      "INVALID_EMAIL"
    );
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "pending") {
      throw new UserAuthError(
        "This email is already registered and awaiting approval",
        409,
        "EMAIL_PENDING"
      );
    }
    if (existing.status === "approved") {
      throw new UserAuthError(
        "This email is already registered. Please log in.",
        409,
        "EMAIL_EXISTS"
      );
    }
    // rejected — allow re-registration by updating the record
  }

  // Validate password
  if (!input.password || input.password.length < 8) {
    throw new UserAuthError(
      "Password must be at least 8 characters",
      400,
      "WEAK_PASSWORD"
    );
  }

  // Validate required fields
  if (!input.full_name?.trim()) {
    throw new UserAuthError("Full name is required", 400, "INVALID_NAME");
  }
  if (!input.lgu_name?.trim()) {
    throw new UserAuthError("LGU name is required", 400, "INVALID_LGU");
  }
  if (!input.province?.trim()) {
    throw new UserAuthError("Province is required", 400, "INVALID_PROVINCE");
  }

  const id = existing?.id || crypto.randomUUID();
  const passwordHash = hashPassword(input.password);

  if (existing) {
    // Update previously rejected user
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        fullName: input.full_name.trim(),
        lguName: input.lgu_name.trim(),
        lguType: input.lgu_type || null,
        lguClass: input.lgu_class || null,
        province: input.province.trim(),
        mobilePhone: input.mobile_phone?.trim() || null,
        status: "pending",
        rejectionReason: null,
        approvedBy: null,
        approvedAt: null,
      },
    });
  } else {
    // Insert new user
    await prisma.user.create({
      data: {
        id,
        email: input.email.toLowerCase().trim(),
        passwordHash,
        fullName: input.full_name.trim(),
        lguName: input.lgu_name.trim(),
        lguType: input.lgu_type || null,
        lguClass: input.lgu_class || null,
        province: input.province.trim(),
        mobilePhone: input.mobile_phone?.trim() || null,
        status: "pending",
      },
    });
  }

  console.log(`[user-auth] Registration: ${input.email} (pending approval)`);
  return { id, email: input.email.toLowerCase().trim() };
}

// ── Login ──────────────────────────────────────────────────

export async function authenticateUser(
  email: string,
  password: string
): Promise<UserProfile> {
  if (!email || !password) {
    throw new UserAuthError("Email and password are required", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new UserAuthError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (user.status === "pending") {
    throw new UserAuthError(
      "Your account is awaiting admin approval",
      403,
      "ACCOUNT_PENDING"
    );
  }

  if (user.status === "rejected") {
    throw new UserAuthError(
      `Your registration was rejected${user.rejectionReason ? `: ${user.rejectionReason}` : ""}`,
      403,
      "ACCOUNT_REJECTED"
    );
  }

  // Update login tracking
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
    },
  });

  // Return clean profile (no passwordHash)
  return toUserProfile(user);
}

// ── Session Management ─────────────────────────────────────

export async function createUserSession(userId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + USER_SESSION_MS);

  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  return sessionId;
}

export async function validateUserSession(
  sessionId: string
): Promise<UserSession | null> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  // Check expiration
  if (session.expiresAt < new Date()) {
    await prisma.userSession.delete({ where: { id: sessionId } });
    return null;
  }

  // Check user still approved
  if (session.user.status !== "approved") return null;

  // Sliding window: extend session 1 hour from now
  const newExpiresAt = new Date(Date.now() + USER_SESSION_MS);
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { expiresAt: newExpiresAt },
  });

  return {
    id: session.id,
    expires_at: newExpiresAt.toISOString(),
    user: toUserProfile(session.user),
  };
}

export async function destroyUserSession(sessionId: string): Promise<void> {
  await prisma.userSession.delete({ where: { id: sessionId } });
}

export async function getUserSessionFromRequest(
  request: Request
): Promise<UserSession | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) =>
    c.startsWith(`${USER_SESSION_COOKIE}=`)
  );
  if (!sessionCookie) return null;

  const sessionId = sessionCookie.split("=")[1];
  if (!sessionId) return null;

  return validateUserSession(sessionId);
}

// ── Cookie Helpers ─────────────────────────────────────────

export function setUserSessionCookie(
  headers: Headers,
  sessionId: string
): void {
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = USER_SESSION_HOURS * 60 * 60;
  const cookieDomain = process.env.COOKIE_DOMAIN;
  const domainAttr = cookieDomain ? `Domain=${cookieDomain}; ` : "";

  headers.set(
    "set-cookie",
    `${USER_SESSION_COOKIE}=${sessionId}; ${domainAttr}Path=/; HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Lax; Max-Age=${maxAge}`
  );
}

export function clearUserSessionCookie(headers: Headers): void {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  const domainAttr = cookieDomain ? `Domain=${cookieDomain}; ` : "";

  headers.set(
    "set-cookie",
    `${USER_SESSION_COOKIE}=; ${domainAttr}Path=/; HttpOnly; Max-Age=0`
  );
}

// ── Admin Operations ───────────────────────────────────────

export async function listUsers(filters: {
  status?: string;
  province?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  users: (UserProfile & { approved_by_name?: string })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  // Build Prisma where clause
  const where: Record<string, unknown> = {};
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.province) {
    where.province = filters.province;
  }
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { lguName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const total = await prisma.user.count({ where });

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  // Fetch approver names for users that were approved by an admin
  const adminIds = [
    ...new Set(users.map((u) => u.approvedBy).filter(Boolean)),
  ] as string[];
  const adminNames: Record<string, string> = {};
  if (adminIds.length > 0) {
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, displayName: true },
    });
    for (const a of admins) {
      if (a.displayName) adminNames[a.id] = a.displayName;
    }
  }

  const usersWithNames = users.map((u) => ({
    ...toUserProfile(u),
    ...(u.approvedBy && adminNames[u.approvedBy]
      ? { approved_by_name: adminNames[u.approvedBy] }
      : {}),
  }));

  return {
    users: usersWithNames,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export async function approveUser(
  userId: string,
  approvedByAdminId: string
): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserAuthError("User not found", 404, "USER_NOT_FOUND");
  if (user.status === "approved") {
    throw new UserAuthError("User is already approved", 400, "ALREADY_APPROVED");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "approved",
      approvedBy: approvedByAdminId,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  console.log(
    `[user-auth] User approved: ${user.email} by admin ${approvedByAdminId}`
  );

  return {
    ...toUserProfile(user),
    status: "approved",
    approved_at: new Date().toISOString(),
  };
}

export async function rejectUser(
  userId: string,
  approvedByAdminId: string,
  reason?: string
): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserAuthError("User not found", 404, "USER_NOT_FOUND");

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "rejected",
      approvedBy: approvedByAdminId,
      rejectionReason: reason || null,
      approvedAt: new Date(),
    },
  });

  console.log(
    `[user-auth] User rejected: ${user.email} — ${reason || "no reason"}`
  );

  return {
    ...toUserProfile(user),
    status: "rejected",
    rejection_reason: reason || null,
  };
}

export async function deactivateUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "rejected",
      rejectionReason: "Deactivated by admin",
    },
  });
  // Destroy all sessions for this user
  await prisma.userSession.deleteMany({ where: { userId } });
}

export async function getUserById(
  userId: string
): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return toUserProfile(user);
}

export async function getPendingUserCount(): Promise<number> {
  return prisma.user.count({ where: { status: "pending" } });
}

// ── Constants ──────────────────────────────────────────────

export const USER_SESSION_COOKIE_NAME = USER_SESSION_COOKIE;
