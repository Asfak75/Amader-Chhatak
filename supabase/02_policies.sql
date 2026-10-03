-- ============================================================
-- ধাপ ৪ ও ৫: Storage Bucket + Row Level Security — SQL Editor-এ Run করুন
-- ============================================================
alter table public.categories    enable row level security;
alter table public.news          enable row level security;
alter table public.site_settings enable row level security;

-- বিভাগ: সবাই পড়তে পারবে, শুধু লগইন করা অ্যাডমিন বদলাতে পারবে
drop policy if exists categories_read  on public.categories;
drop policy if exists categories_admin on public.categories;
create policy categories_read  on public.categories for select using (true);
create policy categories_admin on public.categories for all to authenticated using (true) with check (true);

-- সংবাদ: ভিজিটর শুধু প্রকাশিত সংবাদ দেখবে; অ্যাডমিন সব (খসড়াসহ) দেখবে/বদলাবে
drop policy if exists news_public_read on public.news;
drop policy if exists news_admin_all   on public.news;
create policy news_public_read on public.news for select to anon
  using (status = 'published' and published_at <= now());
create policy news_admin_all on public.news for all to authenticated
  using (true) with check (true);

-- সেটিংস: সবাই পড়তে পারবে (গোপন কিছু রাখবেন না), শুধু অ্যাডমিন বদলাবে
drop policy if exists settings_read  on public.site_settings;
drop policy if exists settings_admin on public.site_settings;
create policy settings_read  on public.site_settings for select using (true);
create policy settings_admin on public.site_settings for all to authenticated using (true) with check (true);

-- Storage: ছবির বাকেট (সবার জন্য পড়া যাবে)
insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do update set public = true;

drop policy if exists news_images_read   on storage.objects;
drop policy if exists news_images_insert on storage.objects;
drop policy if exists news_images_update on storage.objects;
drop policy if exists news_images_delete on storage.objects;
create policy news_images_read   on storage.objects for select using (bucket_id = 'news-images');
create policy news_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'news-images');
create policy news_images_update on storage.objects for update to authenticated using (bucket_id = 'news-images');
create policy news_images_delete on storage.objects for delete to authenticated using (bucket_id = 'news-images');
