// src/lib/prisma.ts
// Prisma singleton for PostgreSQL. Replaces better-sqlite3 getDb().
// Usage: import { prisma } from '@/lib/prisma'

import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import crypto from 'crypto'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ========== PASSWORD HASHING (unchanged from db.ts — pure crypto) ==========

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return hash === verifyHash
}

// ========== SEED DEFAULT ADMIN ==========

export async function seedDefaultAdmin(): Promise<void> {
  const count = await prisma.adminUser.count()
  const password = process.env.DEFAULT_ADMIN_PASSWORD

  if (count === 0) {
    if (!password) {
      console.warn('[prisma] No admin users and DEFAULT_ADMIN_PASSWORD not set. Skipping seed.')
      return
    }

    const passwordHash = hashPassword(password)
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        passwordHash,
        displayName: 'Super Admin',
        role: 'super_admin',
      },
    })
    console.log('[prisma] Seeded default super_admin from DEFAULT_ADMIN_PASSWORD.')
    return
  }

  // Security migration: disable default admin if still using compromised password
  const defaultAdmin = await prisma.adminUser.findUnique({ where: { username: 'admin' } })
  if (defaultAdmin && verifyPassword('esangguni-admin-2026', defaultAdmin.passwordHash)) {
    console.warn('[prisma] Default admin uses compromised password. Disabling.')
    await prisma.adminUser.update({
      where: { username: 'admin' },
      data: { isActive: false },
    })
  }
}
