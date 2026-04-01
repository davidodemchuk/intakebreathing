-- Run in Supabase SQL Editor once. Adjust RLS policies before production.
-- Anon key is public; tighten Row Level Security when creator auth ships.

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  handle text not null default '',
  email text,
  name text,
  status text default 'Active',
  niche text,
  address text,
  quality text default 'Standard',
  cost_per_video text,
  notes text,
  instagram_handle text,
  tiktok_handle text,
  youtube_handle text,
  twitter_handle text,
  instagram_url text,
  tiktok_url text,
  ib_score integer,
  ib_score_label text,
  ib_score_breakdown jsonb,
  ai_analysis jsonb,
  tiktok_data jsonb,
  instagram_data jsonb,
  youtube_data jsonb,
  twitter_data jsonb,
  snapchat_data jsonb,
  facebook_data jsonb,
  linkedin_data jsonb,
  tiktok_shop_data jsonb,
  tiktok_recent_videos jsonb,
  tiktok_best_video jsonb,
  tiktok_eng_rate double precision,
  tiktok_avg_views double precision,
  instagram_recent_posts jsonb,
  instagram_recent_reels jsonb,
  instagram_eng_rate double precision,
  instagram_avg_likes double precision,
  instagram_avg_comments double precision,
  engagement_rate double precision,
  cpm_data jsonb,
  total_videos integer default 0,
  video_log jsonb default '[]'::jsonb,
  ai_auto_filled jsonb,
  date_added text,
  last_enriched text,
  invite_token text,
  onboarded boolean default false,
  onboarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  share_id text unique,
  name text,
  brief_data jsonb,
  form_data jsonb,
  mode text default 'template',
  created_by text,
  created_at timestamptz default now()
);

-- Dev / single-tenant: allow anon read/write (replace with proper policies later)
alter table creators enable row level security;
alter table briefs enable row level security;

create policy "creators_all_anon" on creators for all using (true) with check (true);
create policy "briefs_all_anon" on briefs for all using (true) with check (true);

-- Creator portal: brief assignments and messaging (dev: open policies — tighten for production)
create table if not exists brief_assignments (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  status text not null default 'assigned',
  assigned_at timestamptz default now(),
  viewed_at timestamptz,
  unique (brief_id, creator_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  sender text not null check (sender in ('manager', 'creator')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table brief_assignments enable row level security;
alter table messages enable row level security;

create policy "brief_assignments_all_anon" on brief_assignments for all using (true) with check (true);
create policy "messages_all_anon" on messages for all using (true) with check (true);

-- If `creators` already existed without onboarded_at, run once:
-- alter table creators add column if not exists onboarded_at timestamptz;

-- App-wide settings (API keys, manager-password-hash SHA-256, etc.). Run in Supabase SQL Editor if this table is missing.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;
create policy "settings_all_anon" on app_settings for all using (true) with check (true);

-- ═══ CHANNEL PIPELINE SCHEMA ═══
-- Run in Supabase SQL Editor if these tables are missing.

-- Weekly metrics per channel
create table if not exists weekly_metrics (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  week_start date not null,
  week_end date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel, week_start)
);

-- Monthly budget & performance
create table if not exists monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  channel text not null,
  budget numeric,
  actual_spend numeric,
  purchase_value numeric,
  social_views bigint,
  ad_views bigint,
  ads_to_lunar integer,
  ads_launched integer,
  ad_spend numeric,
  purchases integer,
  cpa numeric,
  roas numeric,
  ctr numeric,
  thumbstop numeric,
  ad_cpm numeric,
  ecpm numeric,
  attribution numeric,
  notes text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (month, channel)
);

-- Partnership spend (creator payments)
create table if not exists partnership_spend (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  section text not null,
  status text,
  creator_handle text,
  pay numeric default 0,
  new_pay numeric,
  pl numeric,
  paid_pl numeric,
  platform text,
  ad_usage text,
  organic_views bigint,
  ad_views bigint,
  ad_spend numeric,
  purchase_value numeric,
  roas numeric,
  contract text,
  content_type text,
  num_videos integer,
  deliverable_met boolean default false,
  creator_paid boolean default false,
  creator_name text,
  creator_email text,
  creator_address text,
  notes text,
  creator_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SOPs
create table if not exists sops (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  phase text,
  section text,
  title text not null,
  description text,
  owner text,
  completed boolean default false,
  sop_link text,
  trainual_link text,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Team KPIs
create table if not exists team_kpis (
  id uuid primary key default gen_random_uuid(),
  team_member text not null,
  week_start date not null,
  data jsonb not null default '{}'::jsonb,
  wins text,
  created_at timestamptz default now(),
  unique (team_member, week_start)
);

alter table weekly_metrics enable row level security;
alter table monthly_metrics enable row level security;
alter table partnership_spend enable row level security;
alter table sops enable row level security;
alter table team_kpis enable row level security;

create policy "wm_all" on weekly_metrics for all using (true) with check (true);
create policy "mm_all" on monthly_metrics for all using (true) with check (true);
create policy "ps_all" on partnership_spend for all using (true) with check (true);
create policy "sops_all" on sops for all using (true) with check (true);
create policy "kpi_all" on team_kpis for all using (true) with check (true);

create index if not exists idx_wm_channel on weekly_metrics(channel);
create index if not exists idx_wm_week on weekly_metrics(week_start);
create index if not exists idx_mm_month on monthly_metrics(month);
create index if not exists idx_ps_month on partnership_spend(month);
create index if not exists idx_ps_section on partnership_spend(section);
create index if not exists idx_sops_dept on sops(department);
create index if not exists idx_kpi_member on team_kpis(team_member);
