-- Words 44: error reports, stage 1.
-- Unexpected errors in the app and the user's own "Sorun bildir" messages. No personal data: no user id, no name, no
-- words or articles; only a short message, the screen, the app version, the browser and (for errors) a few lines of
-- the stack with file names and line numbers.
-- Access: the app (anon or signed-in) may only INSERT; nobody can read, change or delete rows through the API.
-- Reports are read in the Supabase dashboard (Table Editor), which uses the service role.
-- Abuse limits: sizes are checked, and at most 120 reports a minute are accepted in total.
-- First-time setup: run once in the Supabase SQL editor. It only creates new objects and drops nothing. If any of
-- them already exists, it stops with an error and, being one transaction, changes nothing.

begin;

create table public.error_reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('error', 'report')),
  message    text not null check (char_length(message) between 1 and 500),
  screen     text not null default '' check (char_length(screen) <= 40),
  version    text not null default '' check (char_length(version) <= 20),
  browser    text not null default '' check (char_length(browser) <= 200),
  detail     text not null default '' check (char_length(detail) <= 2000)
);

comment on table public.error_reports is 'Words 44: anonymous error reports and user feedback (insert only from the app).';

-- At most 120 new reports a minute in total, so a broken client or a misuse cannot flood the table.
create function public.error_reports_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.error_reports where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'too many reports';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger error_reports_limit before insert on public.error_reports
  for each row execute function public.error_reports_limit();

alter table public.error_reports enable row level security;

create policy error_reports_insert on public.error_reports
  for insert to anon, authenticated with check (true);

revoke all on public.error_reports from anon, authenticated;
grant insert (kind, message, screen, version, browser, detail) on public.error_reports to anon, authenticated;

commit;
