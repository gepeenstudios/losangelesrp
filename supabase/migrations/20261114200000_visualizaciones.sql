-- Instagram: visualizaciones (1 por cuenta por publicación)
alter table posts add column if not exists views int not null default 0;
create table if not exists post_views(post_id uuid references posts on delete cascade, user_id uuid default auth.uid(), primary key(post_id, user_id));
alter table post_views enable row level security; -- solo la función de abajo escribe
create or replace function view_posts(ids uuid[]) returns void language sql security definer set search_path=public as $$
  with nuevo as (insert into post_views(post_id, user_id) select p.id, auth.uid() from posts p where p.id = any(ids) and auth.uid() is not null on conflict do nothing returning post_id)
  update posts set views = views + 1 where id in (select post_id from nuevo) $$;
grant execute on function view_posts(uuid[]) to authenticated;
