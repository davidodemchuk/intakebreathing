-- One-time migration for databases created before `purchases` was changed to numeric.
-- Run in Supabase SQL Editor, then apply `seed_monthly_metrics.sql` (after truncate/delete as needed).

alter table monthly_metrics
  alter column purchases type numeric using purchases::numeric;
