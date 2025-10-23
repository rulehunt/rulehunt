# Authentication System Implementation - Phase 1

## Overview

This PR implements **Phase 1** of the user authentication system (Issue #7), providing the core infrastructure for email-based authentication with device linking.

## What's Implemented

### 1. Database Schema (`migrations/0007_add_users_and_auth.sql`)

Created three new tables:

- **`users`** - Stores user accounts with email/password authentication
  - Primary key: `user_id` (UUID)
  - Email (unique), password_hash (bcrypt), display_name
  - Timestamps: created_at, last_login_at
  - Flags: email_verified, is_active

- **`user_devices`** - Links multiple browser UUIDs to one user account
  - Primary key: `device_id` (localStorage UUID from identity.ts)
  - Foreign key: `user_id` → users table
  - Device metadata: device_label, linked_at, last_seen_at
  - Enables cross-device identity without modifying existing `runs` table

- **`sessions`** - Optional server-side session tracking
  - Primary key: `session_id`
  - Foreign key: `user_id`
  - Session lifecycle: expires_at, created_at
  - Optional metadata: user_agent, ip_address

### 2. Authentication API Endpoints

Created three new API endpoints in `functions/api/auth/`:

#### **POST /api/auth/signup**
- Creates new user account
- Hashes password with bcrypt (10 rounds)
- Automatically links current device (localStorage UUID)
- Generates JWT token (30-day expiration)
- Returns: `{ ok: true, userId, token }`

#### **POST /api/auth/login**
- Authenticates existing user
- Verifies password with bcrypt
- Links new devices automatically
- Updates last_login_at and last_seen_at
- Generates JWT token (30-day expiration)
- Returns: `{ ok: true, userId, token }`

#### **POST /api/auth/logout**
- Simple logout endpoint (client-side token removal)
- Provided for consistency and future session management

### 3. Identity Management (`src/identity.ts`)

Extended existing identity system with authentication state:

```typescript
// New authentication functions
getAuthToken(): string | null
setAuthToken(token: string): void
clearAuthToken(): void
isAuthenticated(): boolean
getUserEmail(): string | null
setUserEmail(email: string): void
```

These functions manage:
- `localStorage['rulehunt:authToken']` - JWT token
- `localStorage['rulehunt:userEmail']` - User email

### 4. Auth Modal UI (`src/components/shared/authModal.ts`)

Created reusable authentication modal component:

- **Features:**
  - Combined login/signup form
  - Email and password inputs with validation
  - Error message display
  - Tailwind CSS styling with dark mode support
  - Keyboard shortcuts (Enter to submit)
  - Close on overlay click

- **API:**
  ```typescript
  createAuthModal(config: AuthModalConfig): AuthModalElements
  showAuthModal(elements: AuthModalElements): void
  hideAuthModal(overlay: HTMLDivElement): void
  ```

- **Usage:**
  ```typescript
  const authModal = createAuthModal({
    onSuccess: (userId, email) => {
      console.log('User authenticated:', email)
      // Refresh UI, enable authenticated features, etc.
    },
    onClose: () => {
      console.log('Modal closed')
    }
  })

  document.body.appendChild(authModal.overlay)
  showAuthModal(authModal)
  ```

### 5. Dependencies

Installed required npm packages:

- **bcryptjs** (3.0.2) - Password hashing (Cloudflare Workers compatible)
- **jose** (6.1.0) - JWT token generation and verification
- **nanoid** (5.1.6) - User ID generation

## Setup Instructions

### 1. Apply Database Migration

Run the migration to create the new tables:

```bash
# Local development
wrangler d1 migrations apply rulehunt-db --local

# Production
wrangler d1 migrations apply rulehunt-db --remote
```

### 2. Configure JWT Secret

**IMPORTANT**: The authentication system requires a `JWT_SECRET` environment variable.

#### Local Development

Add to `.dev.vars` (gitignored):

```
JWT_SECRET=your-local-development-secret-here
```

Generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Production (Cloudflare Pages)

Add via Cloudflare dashboard or wrangler:

```bash
# Via wrangler
wrangler pages secret put JWT_SECRET

# Or via Cloudflare dashboard:
# Settings → Environment Variables → Production → Add variable
# Name: JWT_SECRET
# Value: <your-secure-production-secret>
```

### 3. Install Dependencies

Dependencies are already added to package.json. Run:

```bash
pnpm install
```

## How to Use

### In Your Application Code

```typescript
import { createAuthModal, showAuthModal } from './components/shared/authModal'
import { isAuthenticated, getUserEmail, clearAuthToken } from './identity'

// Create the modal once (e.g., in your main app initialization)
const authModal = createAuthModal({
  onSuccess: (userId, email) => {
    console.log('User logged in:', email)
    updateUIForAuthenticatedUser()
  },
  onClose: () => {
    console.log('Auth modal closed')
  }
})

document.body.appendChild(authModal.overlay)

// Show login modal when user clicks "Login" button
loginButton.addEventListener('click', () => {
  showAuthModal(authModal)
})

// Check authentication status
if (isAuthenticated()) {
  const email = getUserEmail()
  console.log('User is logged in as:', email)
} else {
  console.log('User is not authenticated')
}

// Logout
logoutButton.addEventListener('click', () => {
  clearAuthToken()
  updateUIForAnonymousUser()
})
```

### API Usage (Direct Fetch)

```typescript
// Signup
const signupResponse = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123',
    deviceId: getUserId(), // From identity.ts
  })
})

const signupResult = await signupResponse.json()
// { ok: true, userId: '...', token: '...' }

// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword123',
    deviceId: getUserId(),
  })
})

const loginResult = await loginResponse.json()
// { ok: true, userId: '...', token: '...' }
```

## Testing

### Manual Testing Steps

1. **Signup Flow:**
   - Open the auth modal
   - Enter email and password (min 8 chars)
   - Click "Sign Up"
   - Verify token is stored in localStorage
   - Check database for new user and device record

2. **Login Flow:**
   - Clear localStorage (or use different browser)
   - Open the auth modal
   - Enter existing credentials
   - Click "Login"
   - Verify token is stored
   - Check that new device is linked to account

3. **Device Linking:**
   - Login from multiple browsers/devices
   - Check `user_devices` table shows all devices
   - Verify `last_seen_at` updates on each login

4. **Error Handling:**
   - Try signup with existing email (should fail with 409)
   - Try login with wrong password (should fail with 401)
   - Try signup with short password (client-side validation)
   - Try with invalid email format (client-side validation)

### Database Queries for Testing

```sql
-- View all users
SELECT user_id, email, display_name, created_at, last_login_at FROM users;

-- View devices linked to a user
SELECT d.device_id, d.device_label, d.linked_at, d.last_seen_at
FROM user_devices d
JOIN users u ON d.user_id = u.user_id
WHERE u.email = 'user@example.com';

-- View all runs from a user (across all devices)
SELECT r.run_id, r.ruleset_name, r.interest_score, r.submitted_at
FROM runs r
INNER JOIN user_devices ud ON r.user_id = ud.device_id
INNER JOIN users u ON ud.user_id = u.user_id
WHERE u.email = 'user@example.com'
ORDER BY r.submitted_at DESC;
```

## Security Considerations

1. **Password Hashing:**
   - Uses bcrypt with 10 rounds
   - Passwords never stored in plaintext
   - Hashes verified with bcrypt.compare()

2. **JWT Tokens:**
   - Signed with HS256 algorithm
   - 30-day expiration
   - Requires secure JWT_SECRET environment variable

3. **Input Validation:**
   - Email format validation (both client and server)
   - Password minimum length (8 characters)
   - Zod schema validation on API endpoints

4. **Error Messages:**
   - Generic "Invalid credentials" on failed login (no email enumeration)
   - Clear error messages for validation failures
   - Server errors logged but not exposed to client

## What's NOT Implemented (Future Phases)

This is **Phase 1 only**. The following features are planned for future phases:

### Phase 2: User Features & Integration
- [ ] Add "Login" button to UI (desktop and mobile)
- [ ] Display logged-in user email in header
- [ ] Update leaderboard queries to show usernames
- [ ] Sync starred patterns across devices
- [ ] User profile page
- [ ] Device management UI

### Phase 3: Enhanced Features
- [ ] Email verification
- [ ] Password reset flow
- [ ] OAuth integration (Google, GitHub)
- [ ] User profile customization
- [ ] Privacy settings

### Phase 4: Advanced Features
- [ ] Per-user leaderboards
- [ ] Discovery attribution
- [ ] User activity feeds
- [ ] Achievement system

## File Changes Summary

### New Files
```
migrations/0007_add_users_and_auth.sql
functions/api/auth/signup.ts
functions/api/auth/login.ts
functions/api/auth/logout.ts
src/components/shared/authModal.ts
IMPLEMENTATION_NOTES.md (this file)
```

### Modified Files
```
src/identity.ts (added auth state functions)
package.json (added dependencies)
pnpm-lock.yaml (dependency lockfile)
```

## Architecture Decisions

### Why Device Linking vs User ID Migration?

The design links devices to users rather than migrating existing runs:

**Pros:**
- ✅ No data migration needed for existing runs
- ✅ Backward compatible with anonymous users
- ✅ Simple join queries to aggregate user runs
- ✅ Preserves original submission device in audit trail

**Cons:**
- ❌ Slightly more complex queries (requires JOIN)
- ❌ Device UUIDs remain in runs table

**Query Pattern:**
```sql
-- Get all runs for authenticated user
SELECT r.*
FROM runs r
INNER JOIN user_devices ud ON r.user_id = ud.device_id
WHERE ud.user_id = ?
```

### Why JWT Instead of Sessions?

- Works well with Cloudflare Workers edge runtime
- Stateless (no database lookup per request)
- Easy to implement with jose library
- Can be extended to server-side sessions later if needed

### Why bcryptjs Instead of Argon2?

- Better compatibility with Cloudflare Workers
- Widely adopted and battle-tested
- Sufficient security with proper round count (10)

## Deployment Checklist

Before deploying to production:

- [ ] Set JWT_SECRET in Cloudflare Pages environment variables
- [ ] Apply database migration to production D1
- [ ] Test signup/login flows in staging
- [ ] Verify bcryptjs works in Workers runtime
- [ ] Check JWT token expiration behavior
- [ ] Test device linking across browsers
- [ ] Verify error handling and messages

## Questions or Issues?

See Issue #7 for full requirements and discussion.

For implementation questions, check:
- `functions/api/auth/*.ts` - API endpoint implementations
- `src/components/shared/authModal.ts` - UI component code
- `src/identity.ts` - Auth state management
- `migrations/0007_add_users_and_auth.sql` - Database schema

---

**Implementation Date:** 2025-10-23
**Phase:** 1 of 4
**Status:** ✅ Core authentication system complete
