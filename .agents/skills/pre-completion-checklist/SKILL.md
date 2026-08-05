---
name: pre-completion-checklist
description: Use before declaring any feature or fix complete
---

Before saying something is done, confirm all of the following explicitly,
not just "it compiles":
- Ran an actual end-to-end test with real data (not just type-checked)
- Tested at least one negative/edge case, not just the happy path
- No `any` casts introduced or left in place
- No dead code left behind from refactors (search for orphaned files/routes)
- Cleaned up any temporary test data created during verification
- Accessibility: keyboard nav + labels on any new interactive UI
- Mobile: actually checked at 320px, not just assumed responsive classes
  handle it
If any of these wasn't actually done, say so plainly instead of implying
completion.