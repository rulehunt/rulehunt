/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { handleApiError, jsonResponse } from '../../utils/api-helpers'

// Validation schema for signup request
const SignupRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceLabel: z.string().optional(),
})

type SignupRequest = z.infer<typeof SignupRequestSchema>

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
 * POST /api/auth/signup
 *
 * Create new user account with email/password authentication.
 * Automatically links the current device to the new account.
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
 * Success response (201):
 * ```json
 * {
 *   "ok": true,
 *   "userId": "generated-user-id",
 *   "token": "jwt-token-string"
 * }
 * ```
 *
 * Error responses:
 * - 400: Invalid request format or validation error
 * - 409: Email already registered
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

    const data: SignupRequest = SignupRequestSchema.parse(body)

    // --- Check if email already exists ---
    const existing = await ctx.env.DB.prepare(
      'SELECT user_id FROM users WHERE email = ?',
    )
      .bind(data.email)
      .first()

    if (existing) {
      return jsonResponse({ ok: false, error: 'Email already registered' }, 409)
    }

    // --- Hash password ---
    const passwordHash = await bcrypt.hash(data.password, 10)

    // --- Create user ---
    const userId = nanoid()

    await ctx.env.DB.prepare(
      `
      INSERT INTO users (user_id, email, password_hash, last_login_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `,
    )
      .bind(userId, data.email, passwordHash)
      .run()

    // --- Link current device ---
    await ctx.env.DB.prepare(
      `
      INSERT INTO user_devices (device_id, user_id, device_label)
      VALUES (?, ?, ?)
    `,
    )
      .bind(data.deviceId, userId, data.deviceLabel || 'Primary Device')
      .run()

    // --- Generate JWT token ---
    const jwtSecret = ctx.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('[signup] JWT_SECRET environment variable not configured')
      return jsonResponse(
        { ok: false, error: 'Server configuration error' },
        500,
      )
    }

    const token = await generateAuthToken(userId, jwtSecret)

    return jsonResponse(
      {
        ok: true,
        userId,
        token,
      },
      201,
    )
  } catch (error) {
    return handleApiError(error, 'signup')
  }
}
