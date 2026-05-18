-- Sprint 3 : adaptation de la table notifications existante (Sprint 0)
-- La table existe déjà avec : is_read, metadata (jsonb), type (enum), entity_type (enum)
-- On ajoute : is_seen, payload (alias de metadata), valeur 'payment' dans l'enum

alter table public.notifications
  add column if not exists is_seen boolean not null default false,
  add column if not exists payload jsonb;

-- Synchroniser payload depuis metadata pour les éventuelles données existantes
update public.notifications set payload = metadata where payload is null and metadata is not null;

-- Ajouter la valeur 'payment' à l'enum notification_type
alter type public.notification_type add value if not exists 'payment';

-- Indexes manquants
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_unseen_idx
  on public.notifications (recipient_id)
  where is_seen = false;

-- Policies avec (select auth.uid()) pour la perf
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'users see their own notifications'
  ) then
    execute 'create policy "users see their own notifications"
      on public.notifications for select
      using (( select auth.uid()) = recipient_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications' and policyname = 'users update their own notifications'
  ) then
    execute 'create policy "users update their own notifications"
      on public.notifications for update
      using (( select auth.uid()) = recipient_id)
      with check (( select auth.uid()) = recipient_id)';
  end if;
end;
$$;