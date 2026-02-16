create table if not exists public.monthly_bill_checks (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  period integer not null check (period in (1, 2)),
  bill_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_bill_checks_unique unique (year, month, period, bill_key)
);

create index if not exists monthly_bill_checks_year_month_idx
  on public.monthly_bill_checks (year, month);

create or replace function public.set_monthly_bill_checks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_monthly_bill_checks_updated_at on public.monthly_bill_checks;

create trigger trg_monthly_bill_checks_updated_at
before update on public.monthly_bill_checks
for each row
execute function public.set_monthly_bill_checks_updated_at();

alter table public.monthly_bill_checks disable row level security;

grant select, insert, update, delete on table public.monthly_bill_checks to anon, authenticated;
