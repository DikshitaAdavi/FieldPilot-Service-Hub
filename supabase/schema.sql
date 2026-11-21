-- FieldPilot Service Hub — Supabase PostgreSQL Schema
-- Run this script once in your Supabase SQL Editor to enable full cloud persistence.

create table if not exists public.fieldpilot_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id text primary key,
  code text not null unique,
  name text not null,
  city text not null,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key,
  full_name text not null,
  email text not null unique,
  role text not null,
  site_id text references public.sites(id),
  tech_code text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id text primary key,
  asset_tag text not null unique,
  name text not null,
  model text not null,
  manufacturer text not null,
  serial_number text not null,
  site_id text references public.sites(id),
  location_detail text,
  status text not null,
  criticality text not null,
  warranty_expires_at timestamptz,
  last_service_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  ticket_number text not null unique,
  type text not null,
  title text not null,
  description text not null,
  state text not null,
  priority text not null,
  impact text not null,
  urgency text not null,
  site_id text references public.sites(id),
  equipment_id text references public.equipment(id),
  requester_id text references public.profiles(id),
  assigned_to text references public.profiles(id),
  pending_reason text,
  escalation_target text,
  workaround_description text,
  resolution_code text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_sessions (
  id text primary key,
  user_id text references public.profiles(id),
  ticket_id text references public.tickets(id),
  channel_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text
);

create table if not exists public.transcripts (
  id text primary key,
  session_id text references public.voice_sessions(id) on delete cascade,
  ticket_id text references public.tickets(id),
  speaker text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_reports (
  id text primary key,
  report_number text not null unique,
  ticket_id text references public.tickets(id),
  session_id text references public.voice_sessions(id),
  summary_narrative text not null,
  diagnosis text not null,
  actions_taken jsonb not null default '[]'::jsonb,
  parts_used jsonb not null default '[]'::jsonb,
  safety_checks jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  generated_by text references public.profiles(id),
  created_at timestamptz not null default now()
);
