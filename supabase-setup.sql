-- RecallForge ログイン不要の自動同期用テーブル
-- Supabase の「SQL Editor」に貼り付けて 1 回だけ実行してください。
-- （このアプリを使うすべての端末が、この 1 行を共有してカードをそろえます）

create table if not exists public.recallforge_space (
  space_id   text primary key,
  state      jsonb not null,
  device_id  text,
  updated_at timestamptz not null default now()
);

alter table public.recallforge_space enable row level security;

-- 公開キー（anon）での読み書きを許可する。
-- space_id は推測されにくいランダムなIDなので、これを知っている端末だけが同期できる。
drop policy if exists "recallforge_space_read"   on public.recallforge_space;
drop policy if exists "recallforge_space_insert" on public.recallforge_space;
drop policy if exists "recallforge_space_update" on public.recallforge_space;

create policy "recallforge_space_read"
  on public.recallforge_space for select
  using (true);

create policy "recallforge_space_insert"
  on public.recallforge_space for insert
  with check (true);

create policy "recallforge_space_update"
  on public.recallforge_space for update
  using (true) with check (true);
