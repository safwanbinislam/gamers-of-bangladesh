---
name: feature-builder
description: Use when building a new feature for this project end-to-end
---

Build new features in this strict order: database schema first, then
backend, then frontend. After each phase:
1. Deploy/apply via Supabase MCP tools
2. Test with REAL data, not just reasoning about the SQL/code — especially
   edge cases (uneven counts, zero-row results, duplicate calls)
3. Run get_advisors(security) after any schema change and fix findings
4. Confirm with the user before moving to the next phase
Do not proceed to backend until database is deployed and tested. Do not
proceed to frontend until backend is built and audited for `any` casts,
dead code, and missing validation.