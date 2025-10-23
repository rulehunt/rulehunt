/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { handleApiError, jsonResponse } from '../../utils/api-helpers'

// Validation schema for login request
const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceLabel: z.string().optional(),
})

type LoginRequest = z.infer<typeof LoginRequestSchema>

interface Env {
  DB: D1Database
  JWT_SECRET: string
}

/**
 * Generate JWT token for authenticated user
 *
 * @param userId - User ID to encode in token
 * @param secret - JWT signing secret
 * @returns JWT token string
 */
async function generateAuthToken(
  userId: string,
  secret: string,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Token expires in 30 days
    .sign(secretKey)

  return token
}

/**
 * POST /api/auth/login
 *
 * Authenticate existing user with email/password.
 * Links the current device if not already linked.
 *
 * Request body:
 * ```json
 * {
 *   "email": "user@example.com",
 *   "password": "securepassword123",
 *   "deviceId": "uuid-from-localstorage",
 *   "deviceLabel": "Optional device name"
 * }
 * ```
 *
 * Success response (200):
 * ```json
 * {
 *   "ok": true,
 *   "userId": "user-id",
 *   "token": "jwt-token-string"
 * }
 * ```
 *
 * Error responses:
 * - 400: Invalid request format or validation error
 * - 401: Invalid credentials (wrong email or password)
 * - 500: Server error
 */
export const onRequestPost = async (
  ctx: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    // --- Parse & validate request ---
    const body = await ctx.request.json().catch(() => null)
    if (!body) {
      return jsonResponse(
        { ok: false, error: 'Invalid JSON in request body' },
        400,
      )
    }

    const data: LoginRequest = LoginRequestSchema.parse(body)

    // --- Find user by email ---
    const user = await ctx.env.DB.prepare(
      `
      SELECT user_id, password_hash, is_active
      FROM users
      WHERE email = ?
    `,
    )
      .bind(data.email)
      .first<{ user_id: string; password_hash: string; is_active: number }>()

    if (!user) {
      return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401)
    }

    // --- Check if account is active ---
    if (user.is_active !== 1) {
      return jsonResponse({ ok: false, error: 'Account is disabled' }, 401)
    }

    // --- Verify password ---
    const validPassword = await bcrypt.compare(
      data.password,
      user.password_hash,
    )

    if (!validPassword) {
      return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401)
    }

    // --- Link device if not already linked ---
    const deviceLinked = await ctx.env.DB.prepare(
      `
      SELECT device_id
      FROM user_devices
      WHERE device_id = ? AND user_id = ?
    `,
    )
      .bind(data.deviceId, user.user_id)
      .first()

    if (!deviceLinked) {
      // Link new device to this account
      await ctx.env.DB.prepare(
        `
        INSERT INTO user_devices (device_id, user_id, device_label)
        VALUES (?, ?, ?)
      `,
      )
        .bind(data.deviceId, user.user_id, data.deviceLabel || 'New Device')
        .run()
    } else {
      // Update last_seen_at for existing device
      await ctx.env.DB.prepare(
        `
        UPDATE user_devices
        SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE device_id = ?
      `,
      )
        .bind(data.deviceId)
        .run()
    }

    // --- Update last login timestamp ---
    await ctx.env.DB.prepare(
      `
      UPDATE users
      SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE user_id = ?
    `,
    )
      .bind(user.user_id)
      .run()

    // --- Generate JWT token ---
    const jwtSecret = ctx.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('[login] JWT_SECRET environment variable not configured')
      return jsonResponse(
        { ok: false, error: 'Server configuration error' },
        500,
      )
    }

    const token = await generateAuthToken(user.user_id, jwtSecret)

    return jsonResponse({
      ok: true,
      userId: user.user_id,
      token,
    })
  } catch (error) {
    return handleApiError(error, 'login')
  }
}
