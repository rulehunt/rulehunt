/// <reference types="@cloudflare/workers-types" />
import { jsonResponse } from '../../utils/api-helpers'

/**
 * POST /api/auth/logout
 *
 * Client-side logout endpoint.
 * For JWT-based auth, logout is primarily client-side (removing the token).
 * This endpoint is provided for consistency and can be extended for
 * server-side session invalidation if needed in the future.
 *
 * Success response (200):
 * ```json
 * {
 *   "ok": true,
 *   "message": "Logged out successfully"
 * }
 * ```
 */
export const onRequestPost = async (): Promise<Response> => {
  // For JWT-based authentication, logout is client-side
  // (client removes token from localStorage)
  //
  // If using server-side sessions table in the future,
  // this endpoint would delete the session record

  return jsonResponse({
    ok: true,
    message: 'Logged out successfully',
  })
}
