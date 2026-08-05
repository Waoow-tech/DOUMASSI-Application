-- E5-04 — Historique multi-conversations : ordre + aperçu.
--
-- La table ai_conversations et ses policies existent depuis le Sprint 0. Il
-- manque deux choses pour un drawer utilisable :
--
--   1. UN ORDRE FIABLE. `updated_at` ne change que quand la LIGNE conversation
--      est modifiée (ex. un titre). Ajouter un message ne la touche pas → une
--      conversation où l'on vient d'écrire ne remonterait pas en tête. On ajoute
--      un trigger qui « touche » la conversation parente à chaque message.
--
--   2. UN APERÇU. Tant que E5-05 (titre auto) n'est pas là, `title` est null. Pour
--      distinguer les conversations dans la liste, on renvoie le 1er message
--      utilisateur comme aperçu — en UNE requête plutôt qu'un N+1 côté client.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1) Trigger : remonter la conversation quand un message y est ajouté
-- ---------------------------------------------------------------------------

create or replace function public.bump_ai_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_ai_conversation on public.ai_messages;
create trigger trg_bump_ai_conversation
  after insert on public.ai_messages
  for each row execute function public.bump_ai_conversation();

-- ---------------------------------------------------------------------------
-- 2) Liste des conversations de l'utilisateur, avec aperçu, plus récentes d'abord
-- ---------------------------------------------------------------------------
-- security definer + filtre explicite sur auth.uid() : la fonction ne renvoie
-- QUE les conversations de l'appelant. (La RLS s'appliquerait de toute façon,
-- mais on double la garde par le where, cohérent avec le reste du projet.)

create or replace function public.get_ai_conversations()
returns table (
  id uuid,
  title text,
  updated_at timestamptz,
  message_count integer,
  preview text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    c.updated_at,
    (select count(*)::int from public.ai_messages m
       where m.conversation_id = c.id and m.role <> 'system'),
    (select m.content from public.ai_messages m
       where m.conversation_id = c.id and m.role = 'user'
       order by m.created_at asc
       limit 1)
  from public.ai_conversations c
  where c.user_id = auth.uid()
  order by c.updated_at desc;
$$;

grant execute on function public.get_ai_conversations() to authenticated;
revoke execute on function public.get_ai_conversations() from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   -- 1) Ajouter un message remonte la conversation
--   --    (envoyer dans une vieille conversation → elle repasse en tête de liste)
--
--   -- 2) get_ai_conversations renvoie mes conversations, plus récente d'abord,
--   --    avec le 1er message user en aperçu et le nb de messages.
--   select id, title, message_count, left(preview, 40) from public.get_ai_conversations();
--
--   -- 3) anon ne peut pas exécuter
--   --    set role anon; select public.get_ai_conversations();  -- => permission denied
-- ---------------------------------------------------------------------------
