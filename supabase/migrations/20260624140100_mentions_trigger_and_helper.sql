-- Sprint 6 — Ticket #213 : mentions @username
--
-- 2/2 : helper d'extraction + trigger de notification.
--
-- Le trigger s'attache à `posts`, `comments` et `messages` (after insert).
-- Il extrait les `@username` du contenu, déduplique, et crée une notification
-- `type='mention'` pour chaque user mentionné, en respectant :
--   - pas d'auto-notification (je me mentionne moi-même → skip)
--   - pas de notification si je bloque ou suis bloqué par la cible
--   - max 5 mentions par contenu → raise exception qui rollback l'INSERT
--     (le client doit valider à 5 max avant d'envoyer, cf Zod côté schémas)
--
-- Suppose que `mention` existe déjà dans l'enum `notification_type`
-- (cf migration 20260624140000).
--
-- À appliquer DEV + STAGING via AI Supabase APRÈS 20260624140000.

-- ─────────────────────────────────────────────────────────────────────────
-- Helper : extrait les usernames mentionnés (lowercase, distinct)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Pattern : @ suivi de 3 à 30 caractères [a-z0-9_], insensible à la casse.
-- On normalise en lowercase et on déduplique pour ne pas notifier 2x si
-- l'utilisateur écrit `@Alice @alice` dans le même contenu.

create or replace function public.fn_extract_mentions(p_content text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select distinct lower(m[1])
      from regexp_matches(coalesce(p_content, ''), '@([A-Za-z0-9_]{3,30})', 'g') as m
    ),
    array[]::text[]
  );
$$;

-- Lisible en lecture par le client (utile pour debug / preview UI).
revoke all on function public.fn_extract_mentions(text) from public, anon;
grant execute on function public.fn_extract_mentions(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger function : fn_notify_mention
-- ─────────────────────────────────────────────────────────────────────────
--
-- Polymorphe : s'adapte à la table source (posts/comments/messages) pour
-- déterminer l'auteur, le contenu, et la cible de navigation (entity_type +
-- entity_id) de la notification générée.
--
-- Pour les comments, on pointe entity_type='post' + entity_id=post_id pour
-- que la notif emmène l'utilisateur sur le post parent (qui contient le
-- commentaire). Le comment_id est stocké dans le payload pour scroll-to.

create or replace function public.fn_notify_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mentions text[];
  v_username text;
  v_mentioned_user_id uuid;
  v_actor_id uuid;
  v_entity_type public.entity_type;
  v_entity_id uuid;
  v_content text;
  v_payload jsonb;
begin
  -- Discrimine selon la table source
  if TG_TABLE_NAME = 'posts' then
    v_actor_id := NEW.author_id;
    v_entity_type := 'post';
    v_entity_id := NEW.id;
    v_content := NEW.content;
    v_payload := jsonb_build_object('preview', left(coalesce(v_content, ''), 100));

  elsif TG_TABLE_NAME = 'comments' then
    -- Les comments soft-deleted ne devraient pas générer de notif. À
    -- l'INSERT, deleted_at est nécessairement null, mais on garde le check
    -- en défense en profondeur (si un jour on autorise INSERT déjà supprimé).
    if NEW.deleted_at is not null then return NEW; end if;
    v_actor_id := NEW.author_id;
    v_entity_type := 'post';
    v_entity_id := NEW.post_id;
    v_content := NEW.content;
    v_payload := jsonb_build_object(
      'preview', left(coalesce(v_content, ''), 100),
      'comment_id', NEW.id
    );

  elsif TG_TABLE_NAME = 'messages' then
    v_actor_id := NEW.sender_id;
    v_entity_type := 'conversation';
    v_entity_id := NEW.conversation_id;
    v_content := NEW.content;
    v_payload := jsonb_build_object(
      'preview', left(coalesce(v_content, ''), 100),
      'message_id', NEW.id
    );

  else
    return NEW;
  end if;

  -- Extrait les mentions du contenu
  v_mentions := public.fn_extract_mentions(v_content);

  -- Garde anti-spam : max 5 mentions par contenu. RAISE rollback l'INSERT,
  -- donc le client doit valider à 5 max AVANT d'envoyer (cf Zod côté
  -- schémas). Code SQLSTATE custom pour que le client puisse mapper l'erreur
  -- en message UX dédié.
  if coalesce(array_length(v_mentions, 1), 0) > 5 then
    raise exception 'Too many mentions (max 5 per content)'
      using errcode = 'P0001';
  end if;

  if coalesce(array_length(v_mentions, 1), 0) = 0 then
    return NEW;
  end if;

  -- Une notif par user mentionné (avec garde-fous)
  foreach v_username in array v_mentions loop
    select id into v_mentioned_user_id
    from public.profiles
    where lower(username) = v_username
    limit 1;

    -- Username inconnu → on ignore silencieusement (utilisateur supprimé,
    -- typo, etc.). Pas d'erreur, c'est juste pas une mention valide.
    if v_mentioned_user_id is null then
      continue;
    end if;

    -- Pas d'auto-notification : je me mentionne moi-même → skip
    if v_mentioned_user_id = v_actor_id then
      continue;
    end if;

    -- Blocage actif (dans un sens ou l'autre) → skip
    if exists (
      select 1 from public.blocks
      where (blocker_id = v_actor_id and blocked_id = v_mentioned_user_id)
         or (blocker_id = v_mentioned_user_id and blocked_id = v_actor_id)
    ) then
      continue;
    end if;

    insert into public.notifications (
      recipient_id, actor_id, type, entity_type, entity_id, payload
    ) values (
      v_mentioned_user_id,
      v_actor_id,
      'mention',
      v_entity_type,
      v_entity_id,
      v_payload
    );
  end loop;

  return NEW;
end;
$$;

-- Hygiène : trigger function pas appelable directement via REST
revoke execute on function public.fn_notify_mention() from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers : posts + comments + messages
-- ─────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_notify_mention_posts on public.posts;
create trigger trg_notify_mention_posts
  after insert on public.posts
  for each row execute function public.fn_notify_mention();

drop trigger if exists trg_notify_mention_comments on public.comments;
create trigger trg_notify_mention_comments
  after insert on public.comments
  for each row execute function public.fn_notify_mention();

drop trigger if exists trg_notify_mention_messages on public.messages;
create trigger trg_notify_mention_messages
  after insert on public.messages
  for each row execute function public.fn_notify_mention();
