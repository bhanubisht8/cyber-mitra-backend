-- 1. Create a table for Public Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  is_admin boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Set up Row Level Security (RLS) for Profiles
alter table public.profiles enable row level security;

-- Drop existing policies if they exist to avoid errors
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 3. Create a Trigger to handle new user signups
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid errors
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Update existing Reports table
-- Add user_id column if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='reports' and column_name='user_id') then
    alter table public.reports add column user_id uuid references auth.users;
  end if;
end $$;

-- Enable RLS on Reports
alter table public.reports enable row level security;

-- Drop existing policies if they exist to avoid errors
drop policy if exists "Users can view their own reports." on public.reports;
drop policy if exists "Users can insert their own reports." on public.reports;
drop policy if exists "Admins can view all reports." on public.reports;

-- Policy: Citizens can see/insert their own reports
create policy "Users can view their own reports." on public.reports
  for select using (auth.uid() = user_id);

create policy "Users can insert their own reports." on public.reports
  for insert with check (auth.uid() = user_id);

-- Policy: Admins can see EVERYTHING
create policy "Admins can view all reports." on public.reports
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
