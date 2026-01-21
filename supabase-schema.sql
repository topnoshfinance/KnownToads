-- KnownToads Database Schema
-- Run this in your Supabase SQL editor

-- Create profiles table
create table profiles (
  fid bigint primary key,
  username text not null,
  pfp_url text not null,
  pfp_cached_at timestamp with time zone not null default now(),
  creator_coin_address text not null,
  chain_id integer not null default 8453,
  x_handle text,
  x_handle_valid boolean default true,
  telegram_handle text,
  telegram_handle_valid boolean default true,
  zora_page_url text,
  zora_page_valid boolean default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create indexes for faster lookups
create index idx_profiles_username on profiles(username);
create index idx_profiles_created_at on profiles(created_at desc);

-- Enable Row Level Security
alter table profiles enable row level security;

-- RLS Policies
create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (true);

create policy "Users can update their own profile"
  on profiles for update
  using (true);

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on profile updates
create trigger update_profiles_updated_at
  before update on profiles
  for each row
  execute function update_updated_at_column();
