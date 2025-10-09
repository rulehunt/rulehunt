Review database migration PR #$ARGUMENTS:

1. Fetch PR: `gh pr view $ARGUMENTS`
2. Get diff: `gh pr diff $ARGUMENTS`
3. Check for:
   - SQL syntax errors (SQLite dialect)
   - Appropriate indexes (partial indexes for boolean filters)
   - Column types match schema.ts Zod definitions
   - Migration naming: `NNNN_description.sql` pattern
   - Reversibility (if applicable)
4. Post review: `gh pr review $ARGUMENTS --comment --body "<findings>"`

Focus on database schema correctness and performance.
