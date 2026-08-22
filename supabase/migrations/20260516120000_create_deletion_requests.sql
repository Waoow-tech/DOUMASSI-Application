-- Migration E3-12 — Demandes de suppression de compte (RGPD)
--
-- Pattern recommandé par la CNIL : ne pas hard-delete immédiatement.
-- L'user demande la suppression → row dans deletion_requests avec
-- scheduled_delete_at = now() + 30 jours. Pendant ces 30 jours, l'user
-- peut annuler en se reconnectant. Passé ce délai, un job background
-- purgera les comptes effectivement (ticket dédié post-MVP).

create table if not exists public.deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text,
  scheduled_delete_at timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz
);

-- Index pour le job background (sélection des demandes à exécuter).
create index if not exists deletion_requests_scheduled_idx
  on public.deletion_requests (scheduled_delete_at)
  where cancelled_at is null;

alter table public.deletion_requests enable row level security;

-- L'user peut lire/créer/annuler sa propre demande, jamais celle des autres.
create policy "users can see their own deletion request"
  on public.deletion_requests for select
  using (auth.uid() = user_id);

create policy "users can request their own deletion"
  on public.deletion_requests for insert
  with check (auth.uid() = user_id);

create policy "users can cancel their own deletion"
  on public.deletion_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);