-- Alumni Connect schema. Run once in Supabase SQL Editor (or via `supabase db push`).

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------- enums ----------
create type tag_kind as enum ('school','faculty','company','job','expertise','help','location');
create type member_status as enum ('unverified','pending','verified','rejected');
create type study_status as enum ('planning','studying','graduated','working_abroad','returned');
create type conn_status as enum ('pending','accepted','declined');

-- ---------- tags (English-only, one row per kind+slug) ----------
create table tags (
  id uuid primary key default gen_random_uuid(),
  kind tag_kind not null,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, slug)
);

-- ---------- members ----------
create table members (
  id uuid primary key references auth.users on delete cascade,
  slug text unique not null,
  slug_locked boolean not null default false,
  full_name text not null default '',
  headline text not null default '',
  bio_en text not null default '',
  bio_vi text not null default '',
  avatar_url text,
  location_tag_id uuid references tags(id) on delete set null,
  current_country text not null default '',
  study_status study_status,
  preferred_locale text not null default 'vi' check (preferred_locale in ('vi','en')),
  public_profile boolean not null default true,
  status member_status not null default 'unverified',
  role text not null default 'member' check (role in ('member','admin')),
  invited_by uuid references members(id) on delete set null,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_status_idx on members (status, public_profile);
create index members_search_idx on members using gin (search_text extensions.gin_trgm_ops);

create table education (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  school_tag_id uuid not null references tags(id),
  faculty_tag_id uuid references tags(id),
  degree text not null default '',
  grad_year int check (grad_year between 1950 and 2100),
  created_at timestamptz not null default now()
);
create index education_member_idx on education (member_id);

create table positions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  company_tag_id uuid not null references tags(id),
  job_tag_id uuid not null references tags(id),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index positions_member_idx on positions (member_id);

-- expertise + "I can help with" tags
create table member_tags (
  member_id uuid not null references members(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (member_id, tag_id)
);

-- private contact details (verified members only)
create table member_contacts (
  member_id uuid primary key references members(id) on delete cascade,
  email text not null default '',
  phone text not null default '',
  linkedin text not null default '',
  facebook text not null default '',
  zalo text not null default ''
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  school_tag_id uuid references tags(id),
  grad_year int,
  evidence_url text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references members(id),
  created_at timestamptz not null default now()
);
create index verifications_status_idx on verifications (status, created_at);

create table connections (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references members(id) on delete cascade,
  to_id uuid not null references members(id) on delete cascade,
  status conn_status not null default 'pending',
  intro_message text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id),
  unique (from_id, to_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  sender_id uuid not null references members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conn_idx on messages (connection_id, created_at);

create table invites (
  code text primary key,
  created_by uuid not null references members(id) on delete cascade,
  max_uses int not null default 5,
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  auto_verify boolean not null default true,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references members(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  reason text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and role = 'admin');
$$;

create function is_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and status = 'verified');
$$;

-- keep search_text (accent-insensitive) and updated_at fresh
create function members_before_write() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.search_text := lower(unaccent(
    coalesce(new.full_name,'') || ' ' || coalesce(new.headline,'') || ' ' ||
    coalesce(new.bio_en,'') || ' ' || coalesce(new.bio_vi,'')));
  new.updated_at := now();
  return new;
end $$;
create trigger members_before_write before insert or update on members
  for each row execute function members_before_write();

-- create a member row for every new auth user
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text;
begin
  base := trim(both '-' from regexp_replace(lower(split_part(new.email,'@',1)), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'member'; end if;
  insert into members (id, slug, full_name)
  values (new.id, base || '-' || substr(md5(random()::text), 1, 5),
          initcap(replace(split_part(new.email,'@',1), '.', ' ')));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- search views (visible = verified + public) ----------
create view member_tag_index as
select member_id, tag_id from (
  select member_id, school_tag_id  as tag_id from education
  union select member_id, faculty_tag_id from education
  union select member_id, company_tag_id from positions
  union select member_id, job_tag_id from positions
  union select member_id, tag_id from member_tags
  union select id, location_tag_id from members
) x
where tag_id is not null
  and exists (select 1 from members m where m.id = x.member_id and m.status = 'verified' and m.public_profile);

create view tag_stats as
select t.id, t.kind, t.name, t.slug, count(distinct i.member_id)::int as member_count
from tags t left join member_tag_index i on i.tag_id = t.id
group by t.id;

-- members that carry ALL given tags
create function members_with_tags(tag_ids uuid[]) returns setof uuid
language sql stable as $$
  select member_id from member_tag_index
  where tag_id = any(tag_ids)
  group by member_id
  having count(distinct tag_id) = cardinality(tag_ids);
$$;

-- ---------- privileges ----------
revoke insert, update, delete on members from anon, authenticated;
grant update (slug, slug_locked, full_name, headline, bio_en, bio_vi, avatar_url, location_tag_id,
              current_country, study_status, preferred_locale, public_profile)
  on members to authenticated;

-- ---------- row level security ----------
alter table tags enable row level security;
alter table members enable row level security;
alter table education enable row level security;
alter table positions enable row level security;
alter table member_tags enable row level security;
alter table member_contacts enable row level security;
alter table verifications enable row level security;
alter table connections enable row level security;
alter table messages enable row level security;
alter table invites enable row level security;
alter table reports enable row level security;

create policy tags_read on tags for select using (true);
create policy tags_insert on tags for insert to authenticated with check (created_by = auth.uid());
create policy tags_admin_update on tags for update to authenticated using (is_admin());
create policy tags_admin_delete on tags for delete to authenticated using (is_admin());

create policy members_read on members for select using (
  (status = 'verified' and public_profile)
  or id = auth.uid()
  or is_admin()
  or exists (select 1 from connections c
             where (c.from_id = auth.uid() and c.to_id = members.id)
                or (c.to_id = auth.uid() and c.from_id = members.id))
);
create policy members_update_own on members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profile detail rows follow the visibility of the member row (RLS applies inside the subquery)
create policy education_read on education for select using (exists (select 1 from members m where m.id = member_id));
create policy education_write on education for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy positions_read on positions for select using (exists (select 1 from members m where m.id = member_id));
create policy positions_write on positions for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy member_tags_read on member_tags for select using (exists (select 1 from members m where m.id = member_id));
create policy member_tags_write on member_tags for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- contacts: owner, admin, or any VERIFIED member (never anonymous)
create policy contacts_read on member_contacts for select to authenticated using (
  member_id = auth.uid() or is_admin()
  or (is_verified() and exists (select 1 from members m where m.id = member_id))
);
create policy contacts_write on member_contacts for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy verifications_read on verifications for select to authenticated
  using (member_id = auth.uid() or is_admin());

create policy connections_read on connections for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or is_admin());

create policy messages_read on messages for select to authenticated using (
  exists (select 1 from connections c where c.id = connection_id and c.status = 'accepted'
          and (c.from_id = auth.uid() or c.to_id = auth.uid())));
create policy messages_insert on messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from connections c where c.id = connection_id and c.status = 'accepted'
      and (c.from_id = auth.uid() or c.to_id = auth.uid())));

create policy invites_read on invites for select to authenticated using (created_by = auth.uid() or is_admin());

create policy reports_insert on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_admin_read on reports for select to authenticated using (is_admin());
create policy reports_admin_update on reports for update to authenticated using (is_admin());

-- ---------- RPC: guarded state changes ----------
create function submit_verification(p_school uuid, p_year int, p_evidence text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from members where id = auth.uid() and status in ('verified','pending')) then
    raise exception 'already verified or pending';
  end if;
  insert into verifications (member_id, school_tag_id, grad_year, evidence_url, note)
  values (auth.uid(), p_school, p_year, coalesce(p_evidence,''), coalesce(p_note,''));
  update members set status = 'pending' where id = auth.uid();
end $$;

create function admin_review(p_member uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update members set status = case when p_approve then 'verified'::member_status else 'rejected'::member_status end
   where id = p_member;
  update verifications set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid()
   where member_id = p_member and status = 'pending';
end $$;

create function send_connect(p_to uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not is_verified() then raise exception 'only verified members can connect'; end if;
  if p_to = auth.uid() then raise exception 'cannot connect to yourself'; end if;
  if not exists (select 1 from members where id = p_to and status = 'verified') then
    raise exception 'member not available';
  end if;
  if exists (select 1 from connections
             where (from_id = auth.uid() and to_id = p_to) or (from_id = p_to and to_id = auth.uid())) then
    raise exception 'connection already exists';
  end if;
  if (select count(*) from connections where from_id = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'daily connect limit reached';
  end if;
  insert into connections (from_id, to_id, intro_message)
  values (auth.uid(), p_to, left(coalesce(p_message,''), 1000)) returning id into new_id;
  return new_id;
end $$;

create function respond_connect(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update connections
     set status = case when p_accept then 'accepted'::conn_status else 'declined'::conn_status end,
         responded_at = now()
   where id = p_id and to_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request not found'; end if;
end $$;

create function create_invite() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_verified() then raise exception 'only verified members can invite'; end if;
  if (select count(*) from invites where created_by = auth.uid() and expires_at > now()) >= 5 then
    raise exception 'too many active invites';
  end if;
  c := substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into invites (code, created_by) values (c, auth.uid());
  return c;
end $$;

create function redeem_invite(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then return false; end if;
  select * into inv from invites where code = p_code and expires_at > now() and uses < max_uses for update;
  if not found then return false; end if;
  update invites set uses = uses + 1 where code = p_code;
  update members
     set invited_by = inv.created_by,
         status = case when inv.auto_verify and status <> 'verified' then 'verified'::member_status else status end
   where id = auth.uid();
  return true;
end $$;

revoke all on function submit_verification, admin_review, send_connect, respond_connect, create_invite, redeem_invite from public, anon;
grant execute on function submit_verification, admin_review, send_connect, respond_connect, create_invite, redeem_invite to authenticated;

-- ---------- storage: public avatar bucket, each user writes only to their own folder ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- seed tags ----------
insert into tags (kind, name, slug) values
  ('help','Mentoring','mentoring'), ('help','Career advice','career-advice'),
  ('help','Job referrals','job-referrals'), ('help','Hiring','hiring'),
  ('help','Scholarships','scholarships'), ('help','Visa advice','visa-advice'),
  ('help','Application review','application-review'), ('help','Housing abroad','housing-abroad'),
  ('help','First job abroad','first-job-abroad'), ('help','Business partnership','business-partnership'),
  ('help','Investment & funding','investment-funding'), ('help','Knowledge sharing','knowledge-sharing'),
  ('expertise','Software engineering','software-engineering'), ('expertise','Data science','data-science'),
  ('expertise','Machine learning','machine-learning'), ('expertise','Product management','product-management'),
  ('expertise','UX design','ux-design'), ('expertise','Marketing','marketing'),
  ('expertise','Finance','finance'), ('expertise','Consulting','consulting'),
  ('expertise','Entrepreneurship','entrepreneurship'), ('expertise','Research','research'),
  ('expertise','Healthcare','healthcare'), ('expertise','Education','education')
on conflict do nothing;

-- To make yourself the first admin, after signing in once, run:
--   update members set role = 'admin', status = 'verified'
--   where id = (select id from auth.users where email = 'you@example.com');
