-- Sprint 4 : policy INSERT manquante sur stories (E4-12)
-- La table avait RLS activé (deny-by-default) mais aucune policy INSERT.
-- author_id utilise DEFAULT auth.uid() — la WITH CHECK s'évalue après les defaults.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stories'
      and policyname = 'stories users insert own'
  ) then
    drop policy if exists "stories users insert own" on public.stories;
    create policy "stories users insert own"
      on public.stories for insert
      to authenticated
      with check (author_id = auth.uid());
  end if;
end;
$$;
