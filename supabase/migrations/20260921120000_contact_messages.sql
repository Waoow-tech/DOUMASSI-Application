-- E8-03 — Formulaire de contact DOUMASSI.
--
-- Stocke les messages envoyés depuis le formulaire de contact. Cette table sert
-- à la fois de journal/backup (si l'envoi d'email échoue on garde une trace) et
-- de base au rate limit « 3 envois / heure / IP », compté côté Edge Function
-- `send-contact` à partir de l'IP HASHÉE.
--
-- Accès : écriture et lecture réservées au service_role (l'Edge Function). La
-- RLS est activée SANS aucune policy → deny-by-default pour anon/authenticated
-- (cf. CLAUDE.md §4). Le service_role bypasse la RLS.
--
-- RGPD / contexte mineurs (ADR-008) : on ne stocke JAMAIS l'IP en clair, mais
-- son empreinte SHA-256 (ip_hash), suffisante pour le comptage anti-spam.

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  -- Auteur connecté (le formulaire vit dans l'espace authentifié). Nullable au
  -- cas où l'entrée serait ouverte aux visiteurs plus tard.
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  email      text not null,
  phone      text,
  company    text,
  subject    text not null,
  message    text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Index dédié au rate limit : compter rapidement les envois d'une même IP sur
-- la dernière heure.
create index if not exists contact_messages_ip_created_idx
  on public.contact_messages (ip_hash, created_at desc);

comment on table public.contact_messages is
  'Messages du formulaire de contact (E8-03). Accès service_role uniquement.';
