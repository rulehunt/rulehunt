Review UI component PR #$ARGUMENTS:

1. Fetch PR: `gh pr view $ARGUMENTS`
2. Get diff: `gh pr diff $ARGUMENTS`
3. Check for:
   - Swipe gesture conflicts (uses data-swipe-ignore where needed)
   - Event swallowing pattern for touch events (passive: true)
   - Cleanup function returned and all listeners removed
   - Accessibility (ARIA labels, semantic HTML)
   - Theme support (dark/light mode CSS classes)
   - Mobile-first responsive design
4. Post review: `gh pr review $ARGUMENTS --comment --body "<findings>"`

Focus on mobile UX and the dual-canvas swipe system integrity.
