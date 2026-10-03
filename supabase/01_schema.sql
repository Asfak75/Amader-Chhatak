-- ============================================================
-- ধাপ ২: টেবিল তৈরি — Supabase → SQL Editor-এ পুরোটা পেস্ট করে Run করুন
-- ============================================================
create extension if not exists pgcrypto;

-- বিভাগ
create table if not exists public.categories (
  slug        text primary key,
  name        text not null,
  sort_order  int  not null default 0
);

insert into public.categories (slug, name, sort_order) values
  ('chhatak',       'ছাতকের সংবাদ', 1),
  ('national',      'জাতীয়',        2),
  ('international', 'আন্তর্জাতিক',   3),
  ('politics',      'রাজনীতি',       4),
  ('sports',        'খেলাধুলা',      5),
  ('education',     'শিক্ষা',        6),
  ('jobs',          'চাকরি',         7),
  ('technology',    'তথ্যপ্রযুক্তি', 8),
  ('opinion',       'মতামত',         9),
  ('others',        'অন্যান্য',      10)
on conflict (slug) do nothing;

-- সংবাদ
create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text not null unique,
  category     text not null references public.categories(slug) on update cascade,
  excerpt      text,
  content      text not null default '',
  image_url    text,
  author       text,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists news_status_pub_idx on public.news (status, published_at desc);
create index if not exists news_category_idx   on public.news (category);

-- সাইট সেটিংস (জরুরি সংবাদ, আমাদের সম্পর্কে ইত্যাদি)
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (key, value) values
  ('breaking_enabled', 'true'),
  ('breaking_news', 'আমাদের ছাতক-এ আপনাকে স্বাগতম'),
  ('about', ''), ('contact', ''), ('privacy', ''), ('terms', '')
on conflict (key) do nothing;

-- updated_at স্বয়ংক্রিয় হালনাগাদ
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists news_updated_at on public.news;
create trigger news_updated_at before update on public.news
  for each row execute function public.set_updated_at();
