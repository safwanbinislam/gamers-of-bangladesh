---
name: type-safety-audit
description: Use after any Supabase schema or RPC change, or when reviewing
  code for `any` casts
---

Never accept an `any` cast as a fix. When one appears:
1. Grep the actual on-disk types file for the table/function in question —
   don't trust a tool's response text claiming types were regenerated
2. If missing, run the real type generation command, then re-check the file
3. Confirm the RPC/table name actually exists via list_tables or a direct
   query — do not assume a plausible-sounding function name is real
4. Remove the cast only after the root cause is fixed, then re-run
   `tsc --noEmit`