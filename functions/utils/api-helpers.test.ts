import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import { jsonResponse, handleApiError } from './api-helpers'

describe('jsonResponse', () => {
	it('should create JSON response with 200 status by default', () => {
		const data = { ok: true, message: 'Success' }
		const response = jsonResponse(data)

		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('application/json')
	})

	it('should create JSON response with custom status', () => {
		const data = { ok: false, error: 'Not found' }
		const response = jsonResponse(data, 404)

		expect(response.status).toBe(404)
		expect(response.headers.get('Content-Type')).toBe('application/json')
	})

	it('should format JSON with 2-space indentation', async () => {
		const data = { nested: { value: 123 } }
		const response = jsonResponse(data)
		const text = await response.text()

		expect(text).toContain('  ')
		expect(text).toBe(JSON.stringify(data, null, 2))
	})

	it('should handle null data', async () => {
		const response = jsonResponse(null)
		const text = await response.text()

		expect(text).toBe('null')
	})

	it('should handle undefined data', async () => {
		const response = jsonResponse(undefined)
		const text = await response.text()

		// JSON.stringify(undefined) returns undefined, which becomes empty string in Response
		expect(text).toBe('')
	})

	it('should handle large objects without truncation', async () => {
		const largeData = {
			items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })),
		}
		const response = jsonResponse(largeData)
		const text = await response.text()
		const parsed = JSON.parse(text)

		expect(parsed.items).toHaveLength(100)
	})
})

describe('handleApiError', () => {
	// Capture console output
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	describe('Zod validation errors', () => {
		it('should handle Zod validation errors with 400 status', async () => {
			const schema = z.object({ name: z.string() })
			let error: unknown

			try {
				schema.parse({ name: 123 }) // Invalid: number instead of string
			} catch (e) {
				error = e
			}

			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(400)
			expect(body).toEqual({
				ok: false,
				error: 'Invalid data format',
				details: expect.any(Array),
			})
			expect(console.error).toHaveBeenCalledWith(
				'test-context validation error:',
				expect.any(Array),
			)
		})

		it('should extract all Zod validation issues', async () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
				email: z.string().email(),
			})

			let error: unknown
			try {
				schema.parse({ name: 123, age: 'not a number', email: 'invalid' })
			} catch (e) {
				error = e
			}

			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(body.details).toHaveLength(3)
		})

		it('should handle nested Zod schema errors', async () => {
			const schema = z.object({
				user: z.object({
					profile: z.object({
						age: z.number(),
					}),
				}),
			})

			let error: unknown
			try {
				schema.parse({ user: { profile: { age: 'not a number' } } })
			} catch (e) {
				error = e
			}

			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(400)
			expect(body.details).toBeDefined()
		})
	})

	describe('D1 database errors', () => {
		it('should detect D1_ERROR in message', async () => {
			const error = new Error('D1_ERROR: Connection failed')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body).toEqual({
				ok: false,
				error: 'Database query failed',
			})
			expect(console.error).toHaveBeenCalledWith(
				'Database error in test-context:',
				error,
			)
		})

		it('should detect SQL syntax errors', async () => {
			const error = new Error('SQL syntax error near SELECT')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Database query failed')
		})

		it('should detect prepare failures', async () => {
			const error = new Error('Failed to prepare statement')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Database query failed')
		})

		it('should detect bind failures', async () => {
			const error = new Error('Cannot bind parameter')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Database query failed')
		})

		it('should be case-insensitive for D1 errors', async () => {
			const error = new Error('d1_error: lowercase')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(body.error).toBe('Database query failed')
		})
	})

	describe('Unexpected errors', () => {
		it('should handle generic Error objects', async () => {
			const error = new Error('Something went wrong')
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body).toEqual({
				ok: false,
				error: 'Internal server error',
			})
			expect(console.error).toHaveBeenCalledWith(
				'Unexpected error in test-context:',
				error,
			)
		})

		it('should handle string errors', async () => {
			const error = 'String error message'
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Internal server error')
		})

		it('should handle null errors', async () => {
			const error = null
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Internal server error')
		})

		it('should handle undefined errors', async () => {
			const error = undefined
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Internal server error')
		})

		it('should handle errors without message property', async () => {
			const error = { code: 'UNKNOWN' }
			const response = handleApiError(error, 'test-context')
			const body = (await response.json()) as Record<string, unknown>

			expect(response.status).toBe(500)
			expect(body.error).toBe('Internal server error')
		})
	})

	describe('Context parameter', () => {
		it('should include context in all log messages', () => {
			const error = new Error('Test error')
			handleApiError(error, 'my-endpoint')

			expect(console.error).toHaveBeenCalledWith(
				'Unexpected error in my-endpoint:',
				error,
			)
		})

		it('should handle empty context string', () => {
			const error = new Error('Test error')
			const response = handleApiError(error, '')

			expect(response.status).toBe(500)
			expect(console.error).toHaveBeenCalledWith('Unexpected error in :', error)
		})
	})

	describe('Error priority and detection order', () => {
		it('should check ZodError before D1 errors', async () => {
			// Create a ZodError with a message that looks like a D1 error
			const schema = z.object({ name: z.string() })
			let zodError: unknown

			try {
				schema.parse({ name: 123 })
			} catch (e) {
				zodError = e
				// Artificially modify the error message to contain "D1"
				if (zodError instanceof z.ZodError) {
					;(zodError as any).message = 'D1_ERROR in validation'
				}
			}

			const response = handleApiError(zodError, 'test')
			const body = (await response.json()) as Record<string, unknown>

			// Should still be treated as validation error (400), not D1 error (500)
			expect(response.status).toBe(400)
			expect(body.error).toBe('Invalid data format')
		})
	})
})
