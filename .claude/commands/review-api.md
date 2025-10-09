Review API endpoint PR #$ARGUMENTS:

1. Fetch PR: `gh pr view $ARGUMENTS`
2. Get diff: `gh pr diff $ARGUMENTS`
3. Check for:
   - Zod schema validation on all inputs
   - Proper error handling (try/catch with appropriate status codes)
   - SQL injection prevention (use parameterized queries only)
   - Consistent error response format: `{ ok: false, error: string }`
   - TypeScript types match Zod schemas
4. Post review: `gh pr review $ARGUMENTS --comment --body "<findings>"`

Focus on API security and consistency with existing endpoints.
