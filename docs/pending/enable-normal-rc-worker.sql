-- APPLIED 2026-09-23 after user approval (진행해).
-- Project: history-learning-test / mrrvuknoxkpowlqcwahk
-- Remote migrations: 20260923023851, 20260923024652.
-- Keep explicit SET permission and disable automatic inheritance.
GRANT history_v5_worker TO postgres WITH SET TRUE;
GRANT history_v5_worker TO postgres WITH INHERIT FALSE;

-- Verified: postgres-granted membership SET true / INHERIT false.
-- The supabase_admin-granted original membership remains unchanged.
-- Reversal of the approved SET change (NOT EXECUTED):
-- GRANT history_v5_worker TO postgres WITH SET FALSE;
