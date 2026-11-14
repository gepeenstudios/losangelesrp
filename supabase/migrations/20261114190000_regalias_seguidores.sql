-- Spotify: el gobierno paga regalías por reproducción. Instagram: seguidores, comentarios y reposts; más seguidores = más pago por like.
alter table songs add column if not exists plays int not null default 0;
create table if not exists song_plays(song_id uuid references songs on delete cascade, character_id uuid references characters on delete cascade, day date not null default current_date, primary key(song_id, character_id, day));
alter table song_plays enable row level security; -- solo la función de abajo escribe
create or replace function song_play(s uuid, c uuid) returns void language plpgsql security definer set search_path=public as $$
declare sg songs; a uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  insert into song_plays(song_id, character_id) values(s, c) on conflict do nothing;
  if not found then return; end if; -- cuenta 1 vez por persona al día
  update songs set plays = plays + 1 where id = s returning * into sg;
  if sg.id is null or not sg.approved or sg.uploader_char is null or owns_char(sg.uploader_char) then return; end if; -- escucharte a ti mismo no paga
  a := personal_acc(sg.uploader_char);
  if a is not null then begin perform move_money(gov_acc(), a, round(coalesce((select (value#>>'{}')::numeric from settings where key='spotify_play_pay'),2) * cpi(), 2), 'Spotify · regalías por reproducción'); exception when others then null; end; end if;
end $$;
grant execute on function song_play(uuid, uuid) to authenticated;

create table if not exists follows(follower uuid references characters on delete cascade, followed uuid references characters on delete cascade, created_at timestamptz default now(), primary key(follower, followed), check (follower <> followed));
alter table follows enable row level security;
drop policy if exists fo_sel on follows; create policy fo_sel on follows for select to authenticated using (true);
drop policy if exists fo_ins on follows; create policy fo_ins on follows for insert to authenticated with check (owns_char(follower));
drop policy if exists fo_del on follows; create policy fo_del on follows for delete to authenticated using (owns_char(follower));
create table if not exists post_comments(id uuid primary key default gen_random_uuid(), post_id uuid not null references posts on delete cascade, character_id uuid references characters on delete cascade,
  body text not null check (length(body) between 1 and 300), created_at timestamptz default now());
alter table post_comments enable row level security;
drop policy if exists pc_sel on post_comments; create policy pc_sel on post_comments for select to authenticated using (true);
drop policy if exists pc_ins on post_comments; create policy pc_ins on post_comments for insert to authenticated with check (owns_char(character_id));
drop policy if exists pc_del on post_comments; create policy pc_del on post_comments for delete to authenticated using (owns_char(character_id) or staff_level()>=2);
alter table posts add column if not exists repost_of uuid references posts on delete cascade;
create unique index if not exists posts_un_repost on posts(character_id, repost_of) where repost_of is not null;

create or replace function like_post(id uuid) returns void language plpgsql security definer set search_path=public as $$
declare p posts; a uuid; pay numeric;
begin
  insert into post_likes(post_id, user_id) values(like_post.id, auth.uid()) on conflict do nothing;
  if not found then return; end if;   -- un like por cuenta
  update posts set likes=likes+1 where posts.id=like_post.id returning * into p;
  if p.character_id is null or exists(select 1 from characters ch where ch.id=p.character_id and user_id=auth.uid()) then return; end if;
  if exists(select 1 from characters ch where ch.id=p.character_id and status='active' and 'Influencer' = any(roles)) then
    -- cada 20 seguidores suben el pago un 100 %, hasta ×5
    pay := coalesce((select (value#>>'{}')::numeric from settings where key='influencer_like_pay'),15) * cpi() * least(5, 1 + (select count(*) from follows f where f.followed = p.character_id) / 20.0);
    a := personal_acc(p.character_id);
    if a is not null then begin perform move_money(gov_acc(), a, round(pay,2), 'Influencer · pago por like'); exception when others then null; end; end if;
  end if;
end $$;
