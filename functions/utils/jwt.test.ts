// @vitest-environment node

import { decodeProtectedHeader, jwtVerify } from 'jose'
import { describe, expect, it } from 'vitest'
import { AUTH_TOKEN_EXPIRATION, generateAuthToken } from './jwt'

const SECRET = 'test-jwt-secret-value'
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60

function verify(token: string, secret = SECRET) {
	return jwtVerify(token, new TextEncoder().encode(secret))
}

describe('AUTH_TOKEN_EXPIRATION', () => {
	it('should be 30 days', () => {
		expect(AUTH_TOKEN_EXPIRATION).toBe('30d')
	})
})

describe('generateAuthToken', () => {
	it('should produce a token that verifies with the signing secret', async () => {
		const token = await generateAuthToken('user-123', SECRET)

		const { payload } = await verify(token)
		expect(payload.userId).toBe('user-123')
	})

	it('should sign with HS256', async () => {
		const token = await generateAuthToken('user-123', SECRET)

		expect(decodeProtectedHeader(token).alg).toBe('HS256')
	})

	it('should set issued-at and a 30 day expiration by default', async () => {
		const token = await generateAuthToken('user-123', SECRET)

		const { payload } = await verify(token)
		expect(payload.iat).toBeTypeOf('number')
		expect(payload.exp).toBeTypeOf('number')
		expect((payload.exp as number) - (payload.iat as number)).toBe(
			THIRTY_DAYS_IN_SECONDS,
		)
	})

	it('should honor a custom expiration', async () => {
		const token = await generateAuthToken('user-123', SECRET, '1h')

		const { payload } = await verify(token)
		expect((payload.exp as number) - (payload.iat as number)).toBe(3600)
	})

	it('should reject verification with a different secret', async () => {
		const token = await generateAuthToken('user-123', SECRET)

		await expect(verify(token, 'a-different-secret')).rejects.toThrow()
	})
})
