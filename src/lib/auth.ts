import crypto from 'crypto'
import { db } from './db'

import { basePath } from './paths'

const SALT_LENGTH = 16
const KEY_LENGTH = 32
const DEFAULT_PASSWORD = 'admin123'
const SESSION_KEY = 'admin_session'
const PASSWORD_KEY = 'admin_password'

export const SESSION_COOKIE_NAME = 'admin_session'

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: basePath || '/',
    maxAge: 60 * 60 * 24,
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

function isHashedPassword(stored: string): boolean {
  return stored.includes(':') && stored.length >= SALT_LENGTH * 2 + 1 + KEY_LENGTH * 2
}

export function verifyPassword(password: string, stored: string): boolean {
  if (isHashedPassword(stored)) {
    const [salt, hash] = stored.split(':')
    const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'))
    } catch {
      return false
    }
  }
  return password === stored
}

export async function getAdminPassword(): Promise<string> {
  const setting = await db.siteSetting.findUnique({ where: { key: PASSWORD_KEY } })
  return setting?.value || DEFAULT_PASSWORD
}

/** Verify password and auto-upgrade plaintext to hashed on success */
export async function verifyAndUpgradePassword(password: string): Promise<boolean> {
  const stored = await getAdminPassword()
  const isValid = verifyPassword(password, stored)

  if (isValid && !isHashedPassword(stored)) {
    const hashed = hashPassword(password)
    await db.siteSetting.upsert({
      where: { key: PASSWORD_KEY },
      update: { value: hashed },
      create: { key: PASSWORD_KEY, value: hashed },
    })
  }

  return isValid
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  const hashed = hashPassword(newPassword)
  await db.siteSetting.upsert({
    where: { key: PASSWORD_KEY },
    update: { value: hashed },
    create: { key: PASSWORD_KEY, value: hashed },
  })
}

export async function createSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  await db.siteSetting.upsert({
    where: { key: SESSION_KEY },
    update: { value: token },
    create: { key: SESSION_KEY, value: token },
  })
  return token
}

export async function verifySession(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/admin_session=([^;]+)/)
  const token = match?.[1]
  if (!token) return false

  const setting = await db.siteSetting.findUnique({ where: { key: SESSION_KEY } })
  if (!setting?.value) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(setting.value))
  } catch {
    return false
  }
}

export async function destroySession(): Promise<void> {
  try {
    await db.siteSetting.delete({ where: { key: SESSION_KEY } })
  } catch {
    // Session may not exist
  }
}
