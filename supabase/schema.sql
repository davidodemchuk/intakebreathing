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
