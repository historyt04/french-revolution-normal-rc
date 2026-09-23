-- NOT APPLIED. Requires the user's requested permission-change confirmation.
-- Target: history-learning-test / mrrvuknoxkpowlqcwahk
-- Existing membership: postgres -> history_v5_worker, ADMIN true, INHERIT false, SET false.
-- Enable only explicit SET ROLE. Keep inheritance and other grants unchanged.
GRANT history_v5_worker TO postgres WITH SET TRUE;

-- Verify after approval and application:
-- BEGIN;
-- SET LOCAL ROLE history_v5_worker;
-- SELECT current_user;
-- ROLLBACK;

-- Reversal of this one change (not executed):
-- GRANT history_v5_worker TO postgres WITH SET FALSE;
