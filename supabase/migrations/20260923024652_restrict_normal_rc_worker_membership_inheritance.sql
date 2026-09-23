-- The new grantor membership defaulted to INHERIT TRUE. Restrict it explicitly.
GRANT history_v5_worker TO postgres WITH INHERIT FALSE;
