# Cloudflare Functions API

This directory contains the Cloudflare Pages Functions that power the RuleHunt API.

## Directory Structure

```
functions/
├── api/                    # API endpoints
│   ├── save.ts            # POST /api/save - Submit simulation runs
│   ├── starred.ts         # GET /api/starred - Fetch random starred pattern
│   ├── leaderboard.ts     # GET /api/leaderboard - Fetch top runs
│   ├── statistics.ts      # GET /api/statistics - Global statistics
│   └── share.ts           # GET /api/share - Share specific runs
├── utils/                  # Shared utilities
│   ├── api-helpers.ts     # JSON responses and error handling
│   └── api-helpers.test.ts # Unit tests for utilities
└── README.md              # This file
```

## Shared Utilities

### `api-helpers.ts`

This module provides standardized utilities for all API endpoints to ensure consistency and reduce code duplication.

#### `jsonResponse(data, status?)`

Creates a JSON response with proper headers.

**Parameters:**
- `data: unknown` - Data to serialize as JSON
- `status?: number` - HTTP status code (default: 200)

**Returns:** `Response` with JSON content-type header

**Example:**
```typescript
import { jsonResponse } from '../utils/api-helpers'

export const onRequestGet = async (ctx) => {
  const data = { ok: true, result: 'success' }
  return jsonResponse(data) // 200 OK
}

export const onRequestPost = async (ctx) => {
  return jsonResponse({ ok: false, error: 'Not found' }, 404)
}
```

#### `handleApiError(error, context)`

Standard error handler for API endpoints with consistent error categorization.

**Parameters:**
- `error: unknown` - The error to handle
- `context: string` - Context string for logging (e.g., 'save', 'leaderboard')

**Returns:** `Response` with appropriate status code and error message

**Error Types:**
1. **Zod Validation Errors** → 400 (client error)
   - Returns detailed validation issues
   - Logs to console.error

2. **D1 Database Errors** → 500 (server error)
   - Detected by regex: `/D1|SQL|prepare|bind/i`
   - Returns generic "Database query failed" message
   - Logs full error to console.error

3. **Unexpected Errors** → 500 (server error)
   - Catches all other errors
   - Returns generic "Internal server error" message
   - Logs full error to console.error

**Example:**
```typescript
import { z } from 'zod'
import { jsonResponse, handleApiError } from '../utils/api-helpers'

const MySchema = z.object({ name: z.string() })

export const onRequestPost = async (ctx) => {
  try {
    const body = await ctx.request.json().catch(() => null)
    if (!body) {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400)
    }

    const data = MySchema.parse(body) // May throw ZodError

    // ... use data ...

    return jsonResponse({ ok: true, data })
  } catch (error) {
    return handleApiError(error, 'my-endpoint')
  }
}
```

## Migration Guide for New Endpoints

When creating a new API endpoint, follow this pattern:

### 1. Import Utilities

```typescript
/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { jsonResponse, handleApiError } from '../utils/api-helpers'
```

### 2. Use `jsonResponse()` for All Responses

**Before (duplicated code):**
```typescript
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

return json({ ok: true, data: result })
```

**After (shared utility):**
```typescript
return jsonResponse({ ok: true, data: result })
```

### 3. Use `handleApiError()` for Error Handling

**Before (duplicated code):**
```typescript
try {
  // ... endpoint logic ...
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation error:', error.issues)
    return json(
      { ok: false, error: 'Invalid data format', details: error.issues },
      500,
    )
  }

  if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
    console.error('Database error:', error)
    return json({ ok: false, error: 'Database query failed' }, 500)
  }

  console.error('Unexpected error:', error)
  return json({ ok: false, error: 'Internal server error' }, 500)
}
```

**After (shared utility):**
```typescript
try {
  // ... endpoint logic ...
} catch (error) {
  return handleApiError(error, 'my-endpoint')
}
```

### 4. Complete Example

```typescript
/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { jsonResponse, handleApiError } from '../utils/api-helpers'

const RequestSchema = z.object({
  name: z.string(),
  value: z.number(),
})

export const onRequestPost = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    // Parse and validate request
    const body = await ctx.request.json().catch(() => null)
    if (!body) {
      return jsonResponse({ ok: false, error: 'Invalid JSON in request body' }, 400)
    }

    const data = RequestSchema.parse(body)

    // Database query
    const result = await ctx.env.DB.prepare(
      'INSERT INTO table (name, value) VALUES (?, ?)'
    ).bind(data.name, data.value).run()

    // Success response
    return jsonResponse({ ok: true, id: result.meta.last_row_id })
  } catch (error) {
    // Unified error handling
    return handleApiError(error, 'my-endpoint')
  }
}
```

## Best Practices

### Error Handling

1. **Use appropriate status codes:**
   - `400` for client errors (validation, malformed requests)
   - `404` for not found
   - `500` for server errors (database, unexpected errors)

2. **Don't leak internal error details:**
   - `handleApiError()` automatically sanitizes D1 errors
   - Only validation errors include detailed `details` field

3. **Always include context:**
   - Pass a descriptive context string to `handleApiError()`
   - Use the endpoint name (e.g., 'save', 'leaderboard', 'statistics')

### Testing

All utilities have comprehensive test coverage in `api-helpers.test.ts`:
- JSON response formatting
- Error type detection
- Status code accuracy
- Console logging verification

When modifying utilities, ensure tests continue to pass:
```bash
pnpm test functions/utils/api-helpers.test.ts
```

## Deployment

These functions are automatically deployed via Cloudflare Pages when pushed to the main branch.

**Environment Variables:**
- `DB` - D1 database binding (configured in wrangler.toml)

**Local Development:**
```bash
pnpm dev:worker  # Start local Wrangler dev server
```

## Additional Resources

- [Cloudflare Pages Functions Documentation](https://developers.cloudflare.com/pages/platform/functions/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Zod Validation Documentation](https://zod.dev/)
