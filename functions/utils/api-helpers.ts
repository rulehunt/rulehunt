/// <reference types="@cloudflare/workers-types" />
import { z } from 'zod'

/**
 * Create JSON response with proper headers
 *
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response with JSON content-type header
 *
 * @example
 * ```typescript
 * return jsonResponse({ ok: true, data: result })
 * return jsonResponse({ ok: false, error: 'Not found' }, 404)
 * ```
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Standard error handler for API endpoints
 *
 * Handles three types of errors:
 * 1. Zod validation errors (400 - client error)
 * 2. D1 database errors (500 - server error)
 * 3. Unexpected errors (500 - server error)
 *
 * @param error - The error to handle
 * @param context - Context string for logging (e.g., 'statistics', 'save')
 * @returns Response with appropriate status code and error message
 *
 * @example
 * ```typescript
 * try {
 *   const data = MySchema.parse(body)
 *   // ... use data ...
 * } catch (error) {
 *   return handleApiError(error, 'my-endpoint')
 * }
 * ```
 */
export function handleApiError(error: unknown, context: string): Response {
  // Zod validation errors (client error)
  if (error instanceof z.ZodError) {
    console.error(`${context} validation error:`, error.issues)
    return jsonResponse(
      { ok: false, error: 'Invalid data format', details: error.issues },
      400, // Use 400 for validation errors (client error)
    )
  }

  // D1 database errors (server error)
  if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
    console.error(`Database error in ${context}:`, error)
    return jsonResponse({ ok: false, error: 'Database query failed' }, 500)
  }

  // Unexpected errors (server error)
  console.error(`Unexpected error in ${context}:`, error)
  return jsonResponse({ ok: false, error: 'Internal server error' }, 500)
}
