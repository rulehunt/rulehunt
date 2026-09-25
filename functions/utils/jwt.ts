/// <reference types="@cloudflare/workers-types" />
import { SignJWT } from 'jose'

/**
 * Lifetime of an issued auth token.
 *
 * Defined once here so that signup, login, and any future token-issuing
 * endpoint cannot drift apart. Changing this value changes the expiration of
 * every newly issued token.
 */
export const AUTH_TOKEN_EXPIRATION = '30d'

/**
 * Generate JWT token for authenticated user
 *
 * Signed with HS256 using the caller-supplied secret. The payload carries a
 * single `userId` claim plus the standard `iat` / `exp` claims.
 *
 * @param userId - User ID to encode in token
 * @param secret - JWT signing secret
 * @param expiration - Token lifetime (default: {@link AUTH_TOKEN_EXPIRATION})
 * @returns JWT token string
 *
 * @example
 * ```typescript
 * const token = await generateAuthToken(userId, ctx.env.JWT_SECRET)
 * ```
 */
export async function generateAuthToken(
  userId: string,
  secret: string,
  expiration: string = AUTH_TOKEN_EXPIRATION,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey)

  return token
}
