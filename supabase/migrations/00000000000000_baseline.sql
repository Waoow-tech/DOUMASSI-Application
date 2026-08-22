


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."ai_conversation_category" AS ENUM (
    'general',
    'learning',
    'creative',
    'reflection',
    'image',
    'web_search'
);


ALTER TYPE "public"."ai_conversation_category" OWNER TO "postgres";


CREATE TYPE "public"."ai_message_role" AS ENUM (
    'user',
    'assistant',
    'system'
);


ALTER TYPE "public"."ai_message_role" OWNER TO "postgres";


CREATE TYPE "public"."call_status" AS ENUM (
    'ringing',
    'accepted',
    'rejected',
    'missed',
    'ended',
    'cancelled'
);


ALTER TYPE "public"."call_status" OWNER TO "postgres";


CREATE TYPE "public"."call_type" AS ENUM (
    'audio',
    'video'
);


ALTER TYPE "public"."call_type" OWNER TO "postgres";


CREATE TYPE "public"."entity_type" AS ENUM (
    'post',
    'comment',
    'story',
    'message',
    'profile',
    'call',
    'conversation'
);


ALTER TYPE "public"."entity_type" OWNER TO "postgres";


CREATE TYPE "public"."listing_category" AS ENUM (
    'product',
    'service'
);


ALTER TYPE "public"."listing_category" OWNER TO "postgres";


CREATE TYPE "public"."message_attachment_type" AS ENUM (
    'image',
    'video',
    'audio',
    'file',
    'text'
);


ALTER TYPE "public"."message_attachment_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'follow',
    'follow_request',
    'like',
    'comment',
    'comment_reply',
    'mention',
    'message',
    'call',
    'system',
    'payment'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."wallet_transaction_type" AS ENUM (
    'grant',
    'reward',
    'topup',
    'transfer_in',
    'transfer_out',
    'tip_in',
    'tip_out',
    'purchase',
    'refund',
    'adjustment'
);


ALTER TYPE "public"."wallet_transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_anonymize_user_profile"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_short_hash text;
  v_placeholder_email text;
begin
  v_short_hash := substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_placeholder_email := 'deleted_' || v_short_hash || '@deleted.doumassi.app';

  -- 1. Anonymise le profile
  update public.profiles
  set username = 'deleted_user_' || v_short_hash,
      full_name = null,
      display_name = null,
      bio = null,
      avatar_url = null,
      cover_url = null,
      is_verified = false,
      is_private = true
  where id = p_user_id;

  -- 2. Soft-delete tous les messages privés du user
  update public.messages
  set deleted_at = now()
  where sender_id = p_user_id and deleted_at is null;

  -- 3. auth.users : placeholder email + ban permanent + invalidation sessions
  update auth.users
  set email = v_placeholder_email,
      phone = null,
      raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{deleted}',
        'true'
      ),
      banned_until = '9999-12-31 23:59:59+00'::timestamptz
  where id = p_user_id;

  -- 4. Invalide toutes les sessions
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;

  -- 5. Marque la deletion_request comme processed
  update public.deletion_requests
  set processed_at = now()
  where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."_anonymize_user_profile"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_wallet_apply"("p_user" "uuid", "p_amount" bigint, "p_type" "public"."wallet_transaction_type", "p_idempotency_key" "text", "p_counterparty" "uuid" DEFAULT NULL::"uuid", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance  bigint;
  v_existing bigint;
begin
  select balance into v_balance
  from public.wallets
  where user_id = p_user
  for update;

  if not found then
    raise exception 'Wallet introuvable pour l''utilisateur %', p_user
      using errcode = 'no_data_found';
  end if;

  select balance_after into v_existing
  from public.wallet_transactions
  where user_id = p_user and idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  v_balance := v_balance + p_amount;

  if v_balance < 0 then
    raise exception 'Solde insuffisant' using errcode = 'check_violation';
  end if;

  insert into public.wallet_transactions (
    user_id, amount, type, counterparty_user_id,
    reference_type, reference_id, idempotency_key, balance_after, metadata
  ) values (
    p_user, p_amount, p_type, p_counterparty,
    p_reference_type, p_reference_id, p_idempotency_key, v_balance, p_metadata
  );

  update public.wallets
     set balance = v_balance, updated_at = now()
   where user_id = p_user;

  return v_balance;
end;
$$;


ALTER FUNCTION "public"."_wallet_apply"("p_user" "uuid", "p_amount" bigint, "p_type" "public"."wallet_transaction_type", "p_idempotency_key" "text", "p_counterparty" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_wallet_reward"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user is null or p_amount is null or p_amount <= 0 then
    return null;
  end if;
  return public._wallet_apply(
    p_user, p_amount, 'reward', p_idempotency_key, null, null, null, p_metadata
  );
end;
$$;


ALTER FUNCTION "public"."_wallet_reward"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_follow_request"("p_requester_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  update public.follows
  set status = 'accepted'
  where follower_id = p_requester_id
    and followed_id = v_me
    and status = 'pending';
end;
$$;


ALTER FUNCTION "public"."accept_follow_request"("p_requester_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."boost_listing"("p_listing_id" "uuid", "p_idempotency_key" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user      uuid := auth.uid();
  v_seller    uuid;
  v_new_until timestamptz;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key requis';
  end if;

  select seller_id into v_seller
  from public.listings
  where id = p_listing_id and is_active = true;

  if not found then raise exception 'Annonce introuvable'; end if;
  if v_seller <> v_user then raise exception 'Seul le vendeur peut booster son annonce'; end if;

  -- [BARÈME] 50 Dcoins, puits 'purchase', atomique + idempotent
  perform public._wallet_apply(
    v_user, -50, 'purchase', p_idempotency_key,
    null, 'listing_boost', p_listing_id,
    jsonb_build_object('reason', 'listing_boost', 'days', 7)
  );

  -- [BARÈME] +7 jours cumulables
  update public.listings
     set boosted_until = greatest(now(), coalesce(boosted_until, now())) + interval '7 days'
   where id = p_listing_id
  returning boosted_until into v_new_until;

  return v_new_until;
end;
$$;


ALTER FUNCTION "public"."boost_listing"("p_listing_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_see_content_of"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select
    not public.is_blocked_with(target_user_id)
    and (
      target_user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = target_user_id
        and (
          p.is_private = false
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followed_id = target_user_id
              and f.status = 'accepted'
          )
        )
      )
    );
$$;


ALTER FUNCTION "public"."can_see_content_of"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_post"("p_author_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    -- Viewer non authentifié → rien
    auth.uid() is not null
    and (
      -- 1. Le viewer est l'auteur
      auth.uid() = p_author_id
      or (
        -- 6. Pas de blocage bilatéral
        not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p_author_id)
             or (b.blocker_id = p_author_id and b.blocked_id = auth.uid())
        )
        and (
          -- 2. Profil public
          exists (
            select 1 from public.profiles pr
            where pr.id = p_author_id and pr.is_private = false
          )
          or
          -- 3. Profil privé + follow accepté
          exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followed_id = p_author_id
              and f.status = 'accepted'
          )
        )
      )
    );
$$;


ALTER FUNCTION "public"."can_view_post"("p_author_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_account_deletion"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  v_updated int;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.deletion_requests
  set cancelled_at = now()
  where user_id = v_me
    and cancelled_at is null
    and processed_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;


ALTER FUNCTION "public"."cancel_account_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer DEFAULT 20) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  current_count int;
begin
  insert into public.ai_rate_limits (user_id, day, requests_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update
  set requests_count = ai_rate_limits.requests_count + 1
  returning requests_count into current_count;

  return current_count <= p_max_requests;
end;
$$;


ALTER FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer) IS 'Atomic check+increment du rate limit. Retourne true si sous le max, false sinon.';



CREATE OR REPLACE FUNCTION "public"."count_unread_notifications"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::int from public.notifications
  where recipient_id = auth.uid() and is_seen = false;
$$;


ALTER FUNCTION "public"."count_unread_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_comment"("p_post_id" "uuid", "p_content" "text", "p_parent_comment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_user uuid := auth.uid(); v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if length(trim(p_content)) = 0 then raise exception 'Empty content'; end if;
  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.deleted_at is null and public.can_view_post(p.author_id)
  ) then raise exception 'Post not visible'; end if;

  if p_parent_comment_id is not null then
    if not exists (
      select 1 from public.comments c
      where c.id = p_parent_comment_id and c.post_id = p_post_id
        and c.deleted_at is null and c.parent_comment_id is null
    ) then raise exception 'Invalid parent comment'; end if;
  end if;

  insert into public.comments (post_id, author_id, content, parent_comment_id)
  values (p_post_id, v_user, p_content, p_parent_comment_id)
  returning id into v_new_id;
  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."create_comment"("p_post_id" "uuid", "p_content" "text", "p_parent_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_group_conversation"("p_name" "text", "p_participant_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_conv_id uuid; v_invited uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'group name required' using errcode = '22023'; end if;
  if p_participant_ids is null or array_length(p_participant_ids, 1) < 2 then raise exception 'group needs at least 2 other participants' using errcode = '22023'; end if;
  foreach v_invited in array p_participant_ids loop
    if v_invited = v_me then raise exception 'creator cannot be in participant list' using errcode = '22023'; end if;
    if exists (select 1 from public.blocks where (blocker_id=v_me and blocked_id=v_invited) or (blocker_id=v_invited and blocked_id=v_me)) then
      raise exception 'cannot create group with blocked user %', v_invited using errcode = '42501';
    end if;
  end loop;
  insert into public.conversations (is_group, name, created_by) values (true, trim(p_name), v_me) returning id into v_conv_id;
  insert into public.conversation_participants (conversation_id, user_id, role) values (v_conv_id, v_me, 'admin');
  insert into public.conversation_participants (conversation_id, user_id, role) select v_conv_id, unnest(p_participant_ids), 'member';
  return v_conv_id;
end;
$$;


ALTER FUNCTION "public"."create_group_conversation"("p_name" "text", "p_participant_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_listing"("p_category" "text", "p_title" "text", "p_description" "text", "p_price_cents" integer, "p_currency" "text" DEFAULT 'EUR'::"text", "p_images" "text"[] DEFAULT ARRAY[]::"text"[], "p_location" "text" DEFAULT NULL::"text", "p_condition" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  insert into public.listings (
    seller_id, category, title, description, price_cents, currency,
    images, location, condition
  ) values (
    v_user, p_category::listing_category, p_title, p_description, p_price_cents, p_currency,
    p_images, p_location, p_condition
  )
  returning id into v_new_id;
  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."create_listing"("p_category" "text", "p_title" "text", "p_description" "text", "p_price_cents" integer, "p_currency" "text", "p_images" "text"[], "p_location" "text", "p_condition" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quiz"("p_title" "text", "p_level_code" "text", "p_subject_code" "text", "p_questions" "jsonb", "p_resource_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user        uuid := auth.uid();
  v_quiz        uuid;
  v_q           jsonb;
  v_qid         uuid;
  v_opt         jsonb;
  v_qpos        int := 0;
  v_opos        int;
  v_has_correct boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_questions is null or jsonb_array_length(p_questions) < 1 then
    raise exception 'Quiz must have at least 1 question';
  end if;

  insert into public.quizzes (author_id, resource_id, level_code, subject_code, title)
  values (v_user, p_resource_id, p_level_code, p_subject_code, p_title)
  returning id into v_quiz;

  for v_q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_array_length(v_q->'options') < 2 then
      raise exception 'Each question needs at least 2 options';
    end if;

    insert into public.quiz_questions (quiz_id, position, prompt, type)
    values (v_quiz, v_qpos, v_q->>'prompt', coalesce(v_q->>'type', 'single'))
    returning id into v_qid;

    v_opos := 0;
    v_has_correct := false;
    for v_opt in select value from jsonb_array_elements(v_q->'options') loop
      insert into public.quiz_options (question_id, position, label, is_correct)
      values (
        v_qid, v_opos, v_opt->>'label',
        coalesce((v_opt->>'is_correct')::boolean, false)
      );
      if coalesce((v_opt->>'is_correct')::boolean, false) then
        v_has_correct := true;
      end if;
      v_opos := v_opos + 1;
    end loop;

    if not v_has_correct then
      raise exception 'Each question needs at least 1 correct option';
    end if;
    v_qpos := v_qpos + 1;
  end loop;

  update public.quizzes set question_count = v_qpos where id = v_quiz;
  return v_quiz;
end;
$$;


ALTER FUNCTION "public"."create_quiz"("p_title" "text", "p_level_code" "text", "p_subject_code" "text", "p_questions" "jsonb", "p_resource_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_resource"("p_type" "text", "p_level_code" "text", "p_subject_code" "text", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_files" "text"[] DEFAULT ARRAY[]::"text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user   uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  insert into public.resources (
    author_id, type, level_code, subject_code, title, description, files
  ) values (
    v_user, p_type, p_level_code, p_subject_code, p_title, p_description, p_files
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."create_resource"("p_type" "text", "p_level_code" "text", "p_subject_code" "text", "p_title" "text", "p_description" "text", "p_files" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_story_view"("p_story_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  insert into public.story_views (story_id, viewer_id) values (p_story_id, v_user)
  on conflict (story_id, viewer_id) do nothing;
end;
$$;


ALTER FUNCTION "public"."create_story_view"("p_story_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_wallet_for_new_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  -- [BARÈME] bonus de bienvenue = 100
  perform public._wallet_reward(
    new.id, 100, 'signup:' || new.id::text,
    jsonb_build_object('reason', 'signup_bonus')
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."create_wallet_for_new_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_comment"("p_comment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_deleted int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.comments set deleted_at = now()
  where id = p_comment_id and author_id = auth.uid() and deleted_at is null;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;


ALTER FUNCTION "public"."delete_comment"("p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_call"("p_call_id" "uuid", "p_status" "public"."call_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_conv_id uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_status not in ('ended', 'rejected', 'missed', 'cancelled') then raise exception 'invalid terminal status' using errcode = '22023'; end if;
  select conversation_id into v_conv_id from public.calls where id = p_call_id;
  if v_conv_id is null then raise exception 'call not found' using errcode = '02000'; end if;
  if not exists (select 1 from public.conversation_participants where conversation_id = v_conv_id and user_id = v_me) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  update public.calls set status = p_status, ended_at = coalesce(ended_at, now())
  where id = p_call_id and status not in ('ended', 'rejected', 'missed', 'cancelled');
end;
$$;


ALTER FUNCTION "public"."end_call"("p_call_id" "uuid", "p_status" "public"."call_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_follow_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limit int;
  v_count int;
begin
  select int_value into v_limit
  from public.app_config where key = 'matching_requests_per_hour';

  if v_limit is null then return new; end if;

  select count(*) into v_count
  from public.follows f
  where f.follower_id = new.follower_id
    and f.created_at > (now() - interval '1 hour');

  if v_count >= v_limit then
    raise exception 'Trop de demandes envoyées. Réessaie dans un moment.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_follow_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_min_age"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_min_age constant int := 15;
begin
  if new.birthday is not null
     and new.birthday > (current_date - (v_min_age || ' years')::interval) then
    raise exception 'Âge minimum requis : % ans', v_min_age
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_min_age"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_min_age"() IS 'E13-01 — refuse un profil dont la date de naissance implique moins de 15 ans (ADR-008).';



CREATE OR REPLACE FUNCTION "public"."fn_comments_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = NEW.comment_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.comments set like_count = greatest(0, like_count - 1) where id = OLD.comment_id;
    return OLD;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."fn_comments_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_enforce_dm_uniqueness"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_group boolean;
  v_other_user uuid;
  v_existing uuid;
begin
  select is_group into v_is_group from public.conversations where id = NEW.conversation_id;
  if v_is_group is true then return NEW; end if;
  select user_id into v_other_user from public.conversation_participants
  where conversation_id = NEW.conversation_id and user_id <> NEW.user_id limit 1;
  if v_other_user is null then return NEW; end if;
  select c.id into v_existing from public.conversations c
  where c.id <> NEW.conversation_id and c.is_group = false
    and exists (select 1 from public.conversation_participants p1 where p1.conversation_id = c.id and p1.user_id = NEW.user_id)
    and exists (select 1 from public.conversation_participants p2 where p2.conversation_id = c.id and p2.user_id = v_other_user)
    and (select count(*) from public.conversation_participants p3 where p3.conversation_id = c.id) = 2
  limit 1;
  if v_existing is not null then
    raise exception 'duplicate DM conversation between % and %', NEW.user_id, v_other_user using errcode = '23505';
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_enforce_dm_uniqueness"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_extract_mentions"("p_content" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(
    array(
      select distinct lower(m[1])
      from regexp_matches(coalesce(p_content, ''), '@([A-Za-z0-9_]{3,30})', 'g') as m
    ),
    array[]::text[]
  );
$$;


ALTER FUNCTION "public"."fn_extract_mentions"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_conversation_participant"("p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."fn_is_conversation_participant"("p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_post_author uuid;
begin
  if NEW.deleted_at is not null then return NEW; end if;
  select author_id into v_post_author from public.posts where id = NEW.post_id;
  if v_post_author is null or v_post_author = NEW.author_id then return NEW; end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, payload)
  values (v_post_author, NEW.author_id, 'comment', 'post', NEW.post_id,
          jsonb_build_object('preview', left(NEW.content, 100)));
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_notify_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.follower_id = NEW.followed_id then return NEW; end if;

  if TG_OP = 'INSERT' then
    if NEW.status = 'pending' then
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.followed_id, NEW.follower_id, 'follow_request');
    elsif NEW.status = 'accepted' then
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.followed_id, NEW.follower_id, 'follow');
    end if;
  elsif TG_OP = 'UPDATE' then
    if OLD.status = 'pending' and NEW.status = 'accepted' then
      delete from public.notifications
        where recipient_id = NEW.followed_id and actor_id = NEW.follower_id and type = 'follow_request';
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.follower_id, NEW.followed_id, 'follow');
    end if;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_notify_follow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_post_author uuid;
begin
  select author_id into v_post_author from public.posts where id = NEW.post_id;
  if v_post_author is null or v_post_author = NEW.user_id then return NEW; end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  values (v_post_author, NEW.user_id, 'like', 'post', NEW.post_id);
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_notify_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_mention"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  if TG_TABLE_NAME = 'posts' then
    v_actor_id := NEW.author_id;
    v_entity_type := 'post';
    v_entity_id := NEW.id;
    v_content := NEW.content;
    v_payload := jsonb_build_object('preview', left(coalesce(v_content, ''), 100));

  elsif TG_TABLE_NAME = 'comments' then
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

  v_mentions := public.fn_extract_mentions(v_content);

  if coalesce(array_length(v_mentions, 1), 0) > 5 then
    raise exception 'Too many mentions (max 5 per content)'
      using errcode = 'P0001';
  end if;

  if coalesce(array_length(v_mentions, 1), 0) = 0 then
    return NEW;
  end if;

  foreach v_username in array v_mentions loop
    select id into v_mentioned_user_id
    from public.profiles
    where lower(username) = v_username
    limit 1;

    if v_mentioned_user_id is null then
      continue;
    end if;

    if v_mentioned_user_id = v_actor_id then
      continue;
    end if;

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


ALTER FUNCTION "public"."fn_notify_mention"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_recipient uuid;
begin
  if NEW.deleted_at is not null then return NEW; end if;
  for v_recipient in
    select user_id from public.conversation_participants
    where conversation_id = NEW.conversation_id and user_id <> NEW.sender_id
  loop
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, payload)
    values (
      v_recipient, NEW.sender_id, 'message', 'conversation', NEW.conversation_id,
      jsonb_build_object(
        'message_id', NEW.id,
        'preview', case
          when NEW.attachment_type::text = 'text' then left(NEW.content, 100)
          when NEW.attachment_type::text = 'image' then '📷 Photo'
          when NEW.attachment_type::text = 'voice' then '🎤 Message vocal'
          when NEW.attachment_type::text = 'video' then '🎥 Vidéo'
          else left(coalesce(NEW.content, ''), 100)
        end
      )
    );
  end loop;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_notify_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_posts_bookmark_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set bookmark_count = bookmark_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.posts set bookmark_count = greatest(0, bookmark_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."fn_posts_bookmark_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_posts_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    if NEW.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
    end if;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      update public.posts set comment_count = greatest(0, comment_count - 1) where id = NEW.post_id;
    elsif OLD.deleted_at is not null and NEW.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    if OLD.deleted_at is null then
      update public.posts set comment_count = greatest(0, comment_count - 1) where id = OLD.post_id;
    end if;
    return OLD;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."fn_posts_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_posts_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.posts set like_count = greatest(0, like_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."fn_posts_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_conversation_last_message_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_new_last record;
begin
  if OLD.deleted_at is not null or NEW.deleted_at is null then return NEW; end if;
  select id, content, attachment_type, sender_id, created_at into v_new_last
  from public.messages
  where conversation_id = NEW.conversation_id and deleted_at is null
  order by created_at desc limit 1;

  if v_new_last.id is null then
    update public.conversations set last_message_preview = null, last_message_sender_id = null where id = NEW.conversation_id;
  else
    update public.conversations
    set last_message_at = v_new_last.created_at,
        last_message_preview = case
          when v_new_last.attachment_type::text = 'text' then left(v_new_last.content, 100)
          when v_new_last.attachment_type::text = 'image' then '📷 Photo'
          when v_new_last.attachment_type::text = 'voice' then '🎤 Message vocal'
          when v_new_last.attachment_type::text = 'video' then '🎥 Vidéo'
          else left(coalesce(v_new_last.content, ''), 100)
        end,
        last_message_sender_id = v_new_last.sender_id
    where id = NEW.conversation_id;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_recalc_conversation_last_message_on_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_trigger_push_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_service_role_key text;
  v_edge_function_url text := 'https://kbysmkhalnolbsojzahf.supabase.co/functions/v1/send-push';
begin
  -- Récupérer la service role key depuis les secrets vault ou env
  -- On utilise current_setting avec fallback silencieux
  begin
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  exception when others then
    v_service_role_key := null;
  end;

  -- Appel HTTP asynchrone via pg_net
  perform net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_service_role_key, '')
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_trigger_push_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.deleted_at is not null then return NEW; end if;
  update public.conversations
  set last_message_at = NEW.created_at,
      last_message_preview = case
        when NEW.attachment_type::text = 'text' then left(NEW.content, 100)
        when NEW.attachment_type::text = 'image' then '📷 Photo'
        when NEW.attachment_type::text = 'voice' then '🎤 Message vocal'
        when NEW.attachment_type::text = 'video' then '🎥 Vidéo'
        else left(coalesce(NEW.content, ''), 100)
      end,
      last_message_sender_id = NEW.sender_id
  where id = NEW.conversation_id;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_author_reputation"("p_author_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with stats as (
    select
      (
        select count(*) from public.resources r
        where r.author_id = p_author_id and r.status = 'active'
      ) as resource_count,
      (
        select count(*)
        from public.resource_bookmarks rb
        join public.resources r on r.id = rb.resource_id
        where r.author_id = p_author_id and r.status = 'active'
      ) as bookmarks_received
  )
  select jsonb_build_object(
    'resource_count', s.resource_count,
    'bookmarks_received', s.bookmarks_received,
    'tier', case
      when s.resource_count >= 15 or s.bookmarks_received >= 50 then 'expert'
      when s.resource_count >= 5  or s.bookmarks_received >= 10 then 'confirme'
      when s.resource_count >= 1                                then 'contributeur'
      else 'none'
    end
  )
  from stats s;
$$;


ALTER FUNCTION "public"."get_author_reputation"("p_author_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bookmarks"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_full_name" "text", "author_avatar_url" "text", "author_is_verified" boolean, "content" "text", "media_urls" "text"[], "media_type" "text", "location" "text", "created_at" timestamp with time zone, "bookmarked_at" timestamp with time zone, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "view_count" integer, "liked_by_me" boolean, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id, p.author_id, pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    b.created_at as bookmarked_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    true as bookmarked_by_me
  from public.bookmarks b
  join public.posts p on p.id = b.post_id
  join public.profiles pr on pr.id = p.author_id
  where b.user_id = auth.uid()
    and p.deleted_at is null
    and public.can_view_post(p.author_id)
    and (p_cursor is null or b.created_at < p_cursor)
  order by b.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_bookmarks"("p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_boosted_listings"("p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_avatar_url" "text", "seller_is_verified" boolean, "category" "text", "title" "text", "description" "text", "price_cents" integer, "currency" "text", "images" "text"[], "location" "text", "condition" "text", "badge" "text", "discount_percent" integer, "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    l.id, l.seller_id,
    pr.username, pr.avatar_url, coalesce(pr.is_verified, false),
    l.category::text, l.title, l.description, l.price_cents, l.currency,
    l.images, l.location, l.condition, l.badge, l.discount_percent,
    l.view_count, l.created_at,
    exists (
      select 1 from public.listing_bookmarks b
      where b.listing_id = l.id and b.user_id = auth.uid()
    )
  from public.listings l
  join public.profiles pr on pr.id = l.seller_id
  where l.is_active = true
    and l.boosted_until is not null
    and l.boosted_until > now()
  order by l.boosted_until desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_boosted_listings"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_full_name" "text", "author_avatar_url" "text", "author_is_verified" boolean, "content" "text", "media_urls" "text"[], "media_type" "text", "location" "text", "created_at" timestamp with time zone, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "view_count" integer, "liked_by_me" boolean, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id, p.author_id,
    pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.deleted_at is null
    and public.can_view_post(p.author_id)
    and (p_cursor is null or p.created_at < p_cursor)
  order by p.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_feed"("p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_followed_resources"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_avatar_url" "text", "author_is_verified" boolean, "level_code" "text", "subject_code" "text", "type" "text", "title" "text", "description" "text", "files" "text"[], "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.id, r.author_id, p.username, p.avatar_url, coalesce(p.is_verified, false),
    r.level_code, r.subject_code, r.type, r.title, r.description, r.files,
    r.view_count, r.created_at,
    exists (
      select 1 from public.resource_bookmarks b
      where b.resource_id = r.id and b.user_id = auth.uid()
    )
  from public.resources r
  join public.profiles p on p.id = r.author_id
  where r.status = 'active'
    and (
      exists (
        select 1 from public.cours_follows f
        where f.user_id = auth.uid() and f.kind = 'subject' and f.code = r.subject_code
      )
      or exists (
        select 1 from public.cours_follows f
        where f.user_id = auth.uid() and f.kind = 'level' and f.code = r.level_code
      )
    )
    and (p_cursor is null or r.created_at < p_cursor)
  order by r.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_followed_resources"("p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_game_leaderboard"("p_game_id" "text", "p_limit" integer DEFAULT 20) RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "is_verified" boolean, "best_score" integer, "is_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    mx.user_id,
    p.username,
    p.avatar_url,
    coalesce(p.is_verified, false),
    mx.best_score,
    (mx.user_id = auth.uid()) as is_me
  from (
    select user_id, max(score) as best_score
    from public.game_scores
    where game_id = p_game_id
    group by user_id
  ) mx
  join public.profiles p on p.id = mx.user_id
  order by mx.best_score desc, mx.user_id
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_game_leaderboard"("p_game_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_listing_detail"("p_listing_id" "uuid") RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_full_name" "text", "seller_avatar_url" "text", "seller_is_verified" boolean, "category" "text", "title" "text", "description" "text", "price_cents" integer, "currency" "text", "images" "text"[], "location" "text", "condition" "text", "badge" "text", "discount_percent" integer, "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Fix : listings.id qualifié explicitement pour éviter l'ambiguïté avec
  -- la variable de retour "id" déclarée dans RETURNS TABLE
  update public.listings
  set view_count = listings.view_count + 1
  where listings.id = p_listing_id and listings.is_active = true;

  return query
  select
    l.id, l.seller_id, pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    l.category::text, l.title, l.description, l.price_cents, l.currency,
    l.images, l.location, l.condition, l.badge, l.discount_percent,
    l.view_count, l.created_at,
    exists (
      select 1 from public.listing_bookmarks b
      where b.listing_id = l.id and b.user_id = auth.uid()
    )
  from public.listings l
  join public.profiles pr on pr.id = l.seller_id
  where l.id = p_listing_id and l.is_active = true;
end;
$$;


ALTER FUNCTION "public"."get_listing_detail"("p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_listings"("p_category" "text" DEFAULT NULL::"text", "p_condition" "text" DEFAULT NULL::"text", "p_min_price_cents" integer DEFAULT NULL::integer, "p_max_price_cents" integer DEFAULT NULL::integer, "p_sort" "text" DEFAULT 'recent'::"text", "p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_avatar_url" "text", "seller_is_verified" boolean, "category" "text", "title" "text", "description" "text", "price_cents" integer, "currency" "text", "images" "text"[], "location" "text", "condition" "text", "badge" "text", "discount_percent" integer, "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    l.id, l.seller_id,
    pr.username, pr.avatar_url, coalesce(pr.is_verified, false),
    l.category::text, l.title, l.description, l.price_cents, l.currency,
    l.images, l.location, l.condition, l.badge, l.discount_percent,
    l.view_count, l.created_at,
    exists (
      select 1 from public.listing_bookmarks b
      where b.listing_id = l.id and b.user_id = auth.uid()
    )
  from public.listings l
  join public.profiles pr on pr.id = l.seller_id
  where l.is_active = true
    and (p_category is null or l.category::text = p_category)
    and (p_condition is null or l.condition = p_condition)
    and (p_min_price_cents is null or l.price_cents >= p_min_price_cents)
    and (p_max_price_cents is null or l.price_cents <= p_max_price_cents)
    and (p_cursor is null or l.created_at < p_cursor)
  order by
    case when p_sort = 'price_asc' then l.price_cents end asc,
    case when p_sort = 'price_desc' then l.price_cents end desc,
    case when p_sort = 'popular' then l.view_count end desc,
    l.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_listings"("p_category" "text", "p_condition" "text", "p_min_price_cents" integer, "p_max_price_cents" integer, "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_best_game_score"("p_game_id" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select max(score)
  from public.game_scores
  where game_id = p_game_id and user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_best_game_score"("p_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_best_quiz_score"("p_quiz_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select max(score_pct)
  from public.quiz_attempts
  where quiz_id = p_quiz_id and user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_best_quiz_score"("p_quiz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_blocked_users"() RETURNS TABLE("id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "is_verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    coalesce(p.is_verified, false) as is_verified
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;


ALTER FUNCTION "public"."get_my_blocked_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "seller_id" "uuid", "seller_username" "text", "seller_avatar_url" "text", "seller_is_verified" boolean, "category" "text", "title" "text", "description" "text", "price_cents" integer, "currency" "text", "images" "text"[], "location" "text", "condition" "text", "badge" "text", "discount_percent" integer, "view_count" integer, "created_at" timestamp with time zone, "bookmarked_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    l.id,
    l.seller_id,
    p.username      as seller_username,
    p.avatar_url    as seller_avatar_url,
    p.is_verified   as seller_is_verified,
    l.category::text,
    l.title,
    l.description,
    l.price_cents,
    l.currency,
    l.images,
    l.location,
    l.condition,
    l.badge,
    l.discount_percent,
    l.view_count,
    l.created_at,
    lb.created_at   as bookmarked_at,
    true            as bookmarked_by_me
  from public.listing_bookmarks lb
  join public.listings l on l.id = lb.listing_id
  join public.profiles p on p.id = l.seller_id
  where lb.user_id = auth.uid()
    and l.is_active = true
    and (p_cursor is null or lb.created_at < p_cursor)
  order by lb.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone, "p_limit" integer) IS 'E7-16 (#247) — Liste paginée des annonces actives en favori de l''user courant. Cursor sur listing_bookmarks.created_at desc.';



CREATE OR REPLACE FUNCTION "public"."get_my_conversations"() RETURNS TABLE("conversation_id" "uuid", "is_group" boolean, "display_name" "text", "display_avatar_url" "text", "other_user_id" "uuid", "last_message_at" timestamp with time zone, "last_message_preview" "text", "last_message_sender_id" "uuid", "unread_count" bigint, "muted" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
  with my_convs as (select cp.conversation_id, cp.last_read_at, cp.muted_at from public.conversation_participants cp where cp.user_id = v_me),
  other_user as (select cp.conversation_id, cp.user_id as other_id from public.conversation_participants cp where cp.user_id <> v_me and cp.conversation_id in (select conversation_id from my_convs))
  select c.id, c.is_group,
    case when c.is_group then c.name else coalesce(p.username, '?') end,
    case when c.is_group then null else p.avatar_url end,
    case when c.is_group then null else ou.other_id end,
    c.last_message_at, c.last_message_preview, c.last_message_sender_id,
    (select count(*)::bigint from public.messages m where m.conversation_id = c.id and m.created_at > mc.last_read_at and m.sender_id <> v_me and m.deleted_at is null),
    (mc.muted_at is not null)
  from public.conversations c
  join my_convs mc on mc.conversation_id = c.id
  left join other_user ou on ou.conversation_id = c.id
  left join public.profiles p on p.id = ou.other_id
  order by c.last_message_at desc;
end;
$$;


ALTER FUNCTION "public"."get_my_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_cours_follows"() RETURNS TABLE("kind" "text", "code" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select kind, code from public.cours_follows where user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_cours_follows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_deletion_request"() RETURNS TABLE("requested_at" timestamp with time zone, "scheduled_delete_at" timestamp with time zone, "days_remaining" integer, "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select
    dr.requested_at,
    dr.scheduled_delete_at,
    greatest(0, extract(day from dr.scheduled_delete_at - now())::integer) as days_remaining,
    dr.reason
  from public.deletion_requests dr
  where dr.user_id = v_me
    and dr.cancelled_at is null
    and dr.processed_at is null;
end;
$$;


ALTER FUNCTION "public"."get_my_deletion_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notifications"("p_filter" "text" DEFAULT 'all'::"text", "p_limit" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "recipient_id" "uuid", "actor_id" "uuid", "actor_username" "text", "actor_full_name" "text", "actor_avatar_url" "text", "actor_is_verified" boolean, "type" "text", "entity_type" "text", "entity_id" "uuid", "payload" "jsonb", "is_seen" boolean, "is_read" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    n.id, n.recipient_id, n.actor_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    n.type::text, n.entity_type::text, n.entity_id,
    coalesce(n.payload, n.metadata),
    n.is_seen, n.is_read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  where n.recipient_id = auth.uid()
    and case
      when p_filter = 'unread' then n.is_read = false
      when p_filter = 'social' then n.type in ('follow', 'follow_request', 'like', 'comment', 'mention')
      when p_filter = 'payment' then n.type::text = 'payment'
      when p_filter = 'ai' then n.type::text = 'system'
      else true
    end
  order by n.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_notifications"("p_filter" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_dm"("p_other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_me uuid := auth.uid(); v_conv_id uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_me = p_other_user_id then raise exception 'cannot create DM with self' using errcode = '22023'; end if;
  if exists (select 1 from public.blocks where (blocker_id=v_me and blocked_id=p_other_user_id) or (blocker_id=p_other_user_id and blocked_id=v_me)) then
    raise exception 'cannot message blocked user' using errcode = '42501';
  end if;
  select c.id into v_conv_id from public.conversations c
  where c.is_group = false
    and exists (select 1 from public.conversation_participants p1 where p1.conversation_id=c.id and p1.user_id=v_me)
    and exists (select 1 from public.conversation_participants p2 where p2.conversation_id=c.id and p2.user_id=p_other_user_id)
    and (select count(*) from public.conversation_participants p3 where p3.conversation_id=c.id) = 2
  limit 1;
  if v_conv_id is not null then return v_conv_id; end if;
  insert into public.conversations (is_group, created_by) values (false, v_me) returning id into v_conv_id;
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conv_id, v_me, 'admin'), (v_conv_id, p_other_user_id, 'admin');
  return v_conv_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_dm"("p_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "post_id" "uuid", "author_id" "uuid", "author_username" "text", "author_full_name" "text", "author_avatar_url" "text", "author_is_verified" boolean, "parent_comment_id" "uuid", "content" "text", "created_at" timestamp with time zone, "like_count" integer, "liked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.id, c.post_id, c.author_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    c.parent_comment_id, c.content, c.created_at,
    c.like_count,
    exists (select 1 from public.comment_likes cl where cl.comment_id = c.id and cl.user_id = auth.uid())
  from public.comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = p_post_id
    and c.deleted_at is null
    and public.can_view_post((select author_id from public.posts where id = c.post_id))
  order by
    coalesce(c.parent_comment_id, c.id),
    case when c.parent_comment_id is null then 0 else 1 end,
    c.created_at asc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_with_counts"("p_post_id" "uuid") RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_full_name" "text", "author_avatar_url" "text", "author_is_verified" boolean, "content" "text", "media_urls" "text"[], "media_type" "text", "location" "text", "created_at" timestamp with time zone, "like_count" integer, "comment_count" integer, "share_count" integer, "bookmark_count" integer, "view_count" integer, "liked_by_me" boolean, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id, p.author_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.id = p_post_id and p.deleted_at is null and public.can_view_post(p.author_id);
$$;


ALTER FUNCTION "public"."get_post_with_counts"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_quiz"("p_quiz_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'resource_id', q.resource_id,
    'level_code', q.level_code,
    'subject_code', q.subject_code,
    'author_id', q.author_id,
    'author_username', p.username,
    'question_count', q.question_count,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'position', qq.position,
          'prompt', qq.prompt,
          'type', qq.type,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', qo.id, 'position', qo.position, 'label', qo.label)
              order by qo.position
            )
            from public.quiz_options qo where qo.question_id = qq.id
          ), '[]'::jsonb)
        ) order by qq.position
      )
      from public.quiz_questions qq where qq.quiz_id = q.id
    ), '[]'::jsonb)
  )
  from public.quizzes q
  join public.profiles p on p.id = q.author_id
  where q.id = p_quiz_id;
$$;


ALTER FUNCTION "public"."get_quiz"("p_quiz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_resource_detail"("p_resource_id" "uuid") RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_full_name" "text", "author_avatar_url" "text", "author_is_verified" boolean, "level_code" "text", "subject_code" "text", "type" "text", "title" "text", "description" "text", "files" "text"[], "status" "text", "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.resources
    set view_count = public.resources.view_count + 1
  where public.resources.id = p_resource_id
    and public.resources.status = 'active';

  return query
  select
    r.id, r.author_id, p.username, p.full_name, p.avatar_url,
    coalesce(p.is_verified, false),
    r.level_code, r.subject_code, r.type, r.title, r.description, r.files,
    r.status, r.view_count, r.created_at,
    exists (
      select 1 from public.resource_bookmarks b
      where b.resource_id = r.id and b.user_id = auth.uid()
    )
  from public.resources r
  join public.profiles p on p.id = r.author_id
  where r.id = p_resource_id
    and (r.status = 'active' or r.author_id = auth.uid());
end;
$$;


ALTER FUNCTION "public"."get_resource_detail"("p_resource_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_resources"("p_level_code" "text" DEFAULT NULL::"text", "p_subject_code" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_sort" "text" DEFAULT 'recent'::"text", "p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_avatar_url" "text", "author_is_verified" boolean, "level_code" "text", "subject_code" "text", "type" "text", "title" "text", "description" "text", "files" "text"[], "view_count" integer, "created_at" timestamp with time zone, "bookmarked_by_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.id, r.author_id, p.username, p.avatar_url, coalesce(p.is_verified, false),
    r.level_code, r.subject_code, r.type, r.title, r.description, r.files,
    r.view_count, r.created_at,
    exists (
      select 1 from public.resource_bookmarks b
      where b.resource_id = r.id and b.user_id = auth.uid()
    )
  from public.resources r
  join public.profiles p on p.id = r.author_id
  where r.status = 'active'
    and (p_level_code   is null or r.level_code   = p_level_code)
    and (p_subject_code is null or r.subject_code = p_subject_code)
    and (p_type         is null or r.type         = p_type)
    and (
      p_search is null
      or r.title ilike '%' || p_search || '%'
      or coalesce(r.description, '') ilike '%' || p_search || '%'
    )
    and (p_cursor is null or r.created_at < p_cursor)
  order by
    case when p_sort = 'popular' then r.view_count end desc nulls last,
    r.created_at desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_resources"("p_level_code" "text", "p_subject_code" "text", "p_type" "text", "p_search" "text", "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_similar_listings"("p_listing_id" "uuid", "p_limit" integer DEFAULT 4) RETURNS TABLE("id" "uuid", "title" "text", "price_cents" integer, "currency" "text", "images" "text"[], "badge" "text", "discount_percent" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select l2.id, l2.title, l2.price_cents, l2.currency, l2.images, l2.badge, l2.discount_percent
  from public.listings l2
  where l2.is_active = true
    and l2.id <> p_listing_id
    and l2.category = (select category from public.listings where id = p_listing_id)
  order by l2.view_count desc
  limit p_limit;
$$;


ALTER FUNCTION "public"."get_similar_listings"("p_listing_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stories_feed"() RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "author_avatar_url" "text", "author_is_verified" boolean, "media_url" "text", "media_type" "text", "thumbnail_url" "text", "duration_seconds" integer, "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "viewed_by_me" boolean, "is_mine" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with my_follows as (
    select followed_id from public.follows
    where follower_id = auth.uid() and status = 'accepted'
  )
  select s.id, s.author_id, pr.username, pr.avatar_url, coalesce(pr.is_verified, false),
    s.media_url, s.media_type, s.thumbnail_url, s.duration_seconds,
    s.created_at, s.expires_at,
    exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
    s.author_id = auth.uid()
  from public.stories s
  join public.profiles pr on pr.id = s.author_id
  where s.expires_at > now()
    and (s.author_id = auth.uid() or s.author_id in (select followed_id from my_follows))
  order by case when s.author_id = auth.uid() then 0 else 1 end, s.created_at desc;
$$;


ALTER FUNCTION "public"."get_stories_feed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_story_viewers"("p_story_id" "uuid") RETURNS TABLE("viewer_id" "uuid", "viewer_username" "text", "viewer_avatar_url" "text", "viewed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select v.viewer_id, pr.username, pr.avatar_url, v.viewed_at
  from public.story_views v
  join public.profiles pr on pr.id = v.viewer_id
  join public.stories s on s.id = v.story_id
  where v.story_id = p_story_id and s.author_id = auth.uid()
  order by v.viewed_at desc;
$$;


ALTER FUNCTION "public"."get_story_viewers"("p_story_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  meta_username     text;
  meta_display_name text;
  meta_full_name    text;
  meta_birthday     date;
  meta_cgv_at       timestamptz;
  meta_cgv_version  text;
  final_username    text;
  temp_username     text;
  attempt           int := 0;
BEGIN
  meta_username     := trim(NEW.raw_user_meta_data->>'username');
  meta_full_name    := trim(NEW.raw_user_meta_data->>'full_name');
  -- Option B : display_name = full_name en priorité, sinon username en fallback
  -- Fallback final sur username temporaire pour satisfaire la contrainte NOT NULL
  meta_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), '')
  );

  BEGIN
    meta_birthday := (NEW.raw_user_meta_data->>'birthday')::date;
  EXCEPTION WHEN others THEN
    meta_birthday := NULL;
  END;

  BEGIN
    meta_cgv_at := (NEW.raw_user_meta_data->>'cgv_accepted_at')::timestamptz;
  EXCEPTION WHEN others THEN
    meta_cgv_at := NULL;
  END;
  meta_cgv_version := NULLIF(trim(NEW.raw_user_meta_data->>'cgv_version'), '');

  -- Choisir le username final
  IF meta_username IS NOT NULL
     AND length(meta_username) >= 3
     AND length(meta_username) <= 30
     AND meta_username ~ '^[a-zA-Z0-9_]+$'
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(meta_username)
    ) THEN
      final_username := meta_username;
    ELSE
      final_username := NULL;
    END IF;
  ELSE
    final_username := NULL;
  END IF;

  -- Générer un username temporaire si nécessaire
  IF final_username IS NULL THEN
    LOOP
      temp_username := 'user_' || substring(md5(NEW.id::text || clock_timestamp()::text), 1, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(temp_username)
      );
      attempt := attempt + 1;
      IF attempt >= 5 THEN
        temp_username := 'user_' || replace(NEW.id::text, '-', '');
        EXIT;
      END IF;
    END LOOP;
    final_username := temp_username;
  END IF;

  -- display_name fallback sur final_username pour satisfaire NOT NULL
  IF meta_display_name IS NULL THEN
    meta_display_name := final_username;
  END IF;

  INSERT INTO public.profiles (
    id, username, display_name, full_name, birthday,
    cgv_accepted_at, cgv_version
  )
  VALUES (
    NEW.id,
    final_username,
    meta_display_name,
    NULLIF(meta_full_name, ''),
    meta_birthday,
    meta_cgv_at,
    meta_cgv_version
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Crée un profil après inscription.
   Option B : display_name = full_name.
   Lit depuis metadata : username, full_name, birthday, cgv_accepted_at, cgv_version.
   OAuth (Google) : génère username temporaire user_XXXXXXXX.
   Migration 28 — mai 2026';



CREATE OR REPLACE FUNCTION "public"."increment_share_count"("p_post_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.posts
  set share_count = share_count + 1
  where id = p_post_id and deleted_at is null
    and public.can_view_post(author_id)
  returning share_count;
$$;


ALTER FUNCTION "public"."increment_share_count"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_blocked_with"("other_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = other_user_id)
       or (blocker_id = other_user_id and blocked_id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."is_blocked_with"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_username_available"("p_username" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  reserved_names text[] := ARRAY[
    -- Système / admin
    'admin', 'administrator', 'root', 'sudo', 'system', 'staff', 'moderator', 'mod',
    -- Support / help
    'support', 'helpdesk', 'help', 'contact', 'feedback', 'abuse', 'report',
    -- API / technique
    'api', 'app', 'www', 'mail', 'email', 'null', 'undefined', 'true', 'false',
    'anonymous', 'deleted',
    -- Brand
    'doumassi', 'doumassiapp', 'doumassi_app', 'doumassi_official', 'doumassi_team',
    'official', 'team',
    -- Rôles / pronoms
    'ceo', 'founder', 'owner', 'me', 'you', 'user', 'users', 'guest'
  ];
BEGIN
  -- 0. Sanity check : non-null et trim
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN false;
  END IF;

  -- 1. Format : doit commencer par une lettre, suivi de lettres/chiffres/underscores, 3-30 chars
  IF p_username !~ '^[a-zA-Z][a-zA-Z0-9_]{2,29}$' THEN
    RETURN false;
  END IF;

  -- 2. Ne peut pas se terminer par underscore
  IF right(p_username, 1) = '_' THEN
    RETURN false;
  END IF;

  -- 3. Pattern réservé user_XXXXXXXX (8 hex) → réservé au trigger handle_new_user
  IF p_username ~* '^user_[0-9a-f]{8}$' THEN
    RETURN false;
  END IF;

  -- 4. Noms réservés (case-insensitive)
  IF LOWER(p_username) = ANY(reserved_names) THEN
    RETURN false;
  END IF;

  -- 5. Check final d'unicité (case-insensitive)
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(p_username)
  );
END;
$_$;


ALTER FUNCTION "public"."is_username_available"("p_username" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_username_available"("p_username" "text") IS 'Vérifie si un username est disponible (case-insensitive) ET respecte les règles
   de format + noms réservés. Defense-in-depth de src/features/auth/schemas/usernameRules.ts.
   Migration 25 — mai 2026';



CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_seen"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.notifications set is_seen = true
  where recipient_id = auth.uid() and is_seen = false;
$$;


ALTER FUNCTION "public"."mark_all_notifications_seen"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.notifications set is_read = true, is_seen = true
  where id = p_notification_id and recipient_id = auth.uid();
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_follow_request"("p_requester_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;

  delete from public.follows
  where follower_id = p_requester_id
    and followed_id = v_me
    and status = 'pending';

  delete from public.notifications
  where recipient_id = v_me
    and actor_id = p_requester_id
    and type = 'follow_request';
end;
$$;


ALTER FUNCTION "public"."reject_follow_request"("p_requester_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_matching_intent"("p_intent_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user      uuid := auth.uid();
  v_owner     uuid;
  v_threshold int;
  v_count     int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_reason not in ('inapproprie', 'spam', 'faux_profil', 'autre') then
    raise exception 'Motif de signalement invalide';
  end if;
  select user_id into v_owner from public.matching_intents where id = p_intent_id;
  if v_owner is null then raise exception 'Intention introuvable'; end if;
  if v_owner = v_user then raise exception 'Impossible de signaler sa propre intention'; end if;

  insert into public.matching_intent_reports (intent_id, reporter_id, reason)
  values (p_intent_id, v_user, p_reason)
  on conflict (intent_id, reporter_id) do nothing;

  select int_value into v_threshold
  from public.app_config where key = 'matching_intent_report_threshold';

  select count(*) into v_count
  from public.matching_intent_reports where intent_id = p_intent_id;

  if v_threshold is not null and v_count >= v_threshold then
    update public.matching_intents set is_active = false
    where id = p_intent_id and is_active = true;
  end if;
end;
$$;


ALTER FUNCTION "public"."report_matching_intent"("p_intent_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_resource"("p_resource_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user      uuid := auth.uid();
  v_author    uuid;
  v_threshold int;
  v_count     int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select author_id into v_author from public.resources where id = p_resource_id;
  if v_author is null then raise exception 'Resource not found'; end if;
  if v_author = v_user then raise exception 'Cannot report own resource'; end if;

  insert into public.resource_reports (resource_id, reporter_id, reason)
  values (p_resource_id, v_user, p_reason)
  on conflict (resource_id, reporter_id) do nothing;

  update public.resources r
    set report_count = (
      select count(*) from public.resource_reports rr
      where rr.resource_id = p_resource_id
    )
  where r.id = p_resource_id;

  select int_value into v_threshold
  from public.app_config where key = 'resource_report_threshold';

  select report_count into v_count
  from public.resources where id = p_resource_id;

  if v_threshold is not null and v_count >= v_threshold then
    update public.resources
      set status = 'hidden'
    where id = p_resource_id and status <> 'hidden';
  end if;
end;
$$;


ALTER FUNCTION "public"."report_resource"("p_resource_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_account_deletion"("p_reason" "text" DEFAULT NULL::"text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  v_scheduled timestamptz := now() + interval '30 days';
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.deletion_requests (user_id, requested_at, reason, scheduled_delete_at, cancelled_at)
  values (v_me, now(), p_reason, v_scheduled, null)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        reason = excluded.reason,
        scheduled_delete_at = excluded.scheduled_delete_at,
        cancelled_at = null;

  return v_scheduled;
end;
$$;


ALTER FUNCTION "public"."request_account_deletion"("p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reward_course_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- [BARÈME] publication d'un cours = 50
  perform public._wallet_reward(
    new.author_id, 50, 'course_publish:' || new.id::text,
    jsonb_build_object('reason', 'course_publish', 'resource_id', new.id)
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."reward_course_publish"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reward_quiz_pass"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- [BARÈME] seuil 70 %, récompense = 20, 1× par (quiz, user)
  if new.score_pct >= 70 then
    perform public._wallet_reward(
      new.user_id, 20,
      'quiz_pass:' || new.quiz_id::text || ':' || new.user_id::text,
      jsonb_build_object('reason', 'quiz_pass', 'quiz_id', new.quiz_id)
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."reward_quiz_pass"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_users"("p_query" "text", "p_limit" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "is_verified" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  safe_limit int := LEAST(GREATEST(p_limit, 1), 100);
BEGIN
  -- Auth check
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Query vide → retourner rien
  IF length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    FALSE::boolean AS is_verified  -- placeholder, à câbler quand le système de vérification sera en place
  FROM public.profiles p
  WHERE
    -- Exclure le user courant
    p.id != current_user_id
    -- Exclure les users bloqués dans les 2 sens
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = current_user_id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = current_user_id)
    )
    -- Match trigram sur username OU display_name
    AND (
      similarity(p.username, p_query) > 0.3
      OR similarity(COALESCE(p.display_name, ''), p_query) > 0.3
      -- Fallback : prefix match pour les noms courts
      OR p.username ILIKE p_query || '%'
    )
  ORDER BY
    -- Prioriser les matches exacts, puis par similarité
    CASE WHEN LOWER(p.username) = LOWER(p_query) THEN 1
         WHEN p.username ILIKE p_query || '%' THEN 2
         ELSE 3
    END,
    GREATEST(
      similarity(p.username, p_query),
      similarity(COALESCE(p.display_name, ''), p_query)
    ) DESC
  LIMIT safe_limit;
END;
$$;


ALTER FUNCTION "public"."search_users"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_users"("p_query" "text", "p_limit" integer) IS 'Recherche fuzzy d utilisateurs via pg_trgm. Exclut le user courant et les bloqués.
   Paramètres : p_query (min 2 chars), p_limit (default 30, max 100).
   Migration 27 — mai 2026';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_updated_at"() IS 'Trigger qui met à jour la colonne updated_at automatiquement';



CREATE OR REPLACE FUNCTION "public"."soft_delete_post"("p_post_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_deleted int;
begin
  update public.posts
  set deleted_at = now()
  where id = p_post_id
    and author_id = auth.uid()
    and deleted_at is null;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;


ALTER FUNCTION "public"."soft_delete_post"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_game_score"("p_game_id" "text", "p_score" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_score is null or p_score < 0 then raise exception 'Invalid score'; end if;

  insert into public.game_scores (user_id, game_id, score)
  values (v_user, p_game_id, p_score);

  return (
    select max(score) from public.game_scores
    where user_id = v_user and game_id = p_game_id
  );
end;
$$;


ALTER FUNCTION "public"."submit_game_score"("p_game_id" "text", "p_score" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_quiz_attempt"("p_quiz_id" "uuid", "p_answers" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user         uuid := auth.uid();
  v_total        int;
  v_correct      int := 0;
  v_q            record;
  v_selected     uuid[];
  v_correct_opts uuid[];
  v_is_correct   boolean;
  v_corrections  jsonb := '[]'::jsonb;
  v_pct          int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = p_quiz_id;
  if v_total = 0 then raise exception 'Quiz has no questions'; end if;

  for v_q in
    select id from public.quiz_questions where quiz_id = p_quiz_id order by position
  loop
    select coalesce(array_agg(distinct x order by x), '{}')::uuid[]
      into v_selected
    from (
      select (jsonb_array_elements_text(a->'selected_option_ids'))::uuid as x
      from jsonb_array_elements(p_answers) a
      where (a->>'question_id')::uuid = v_q.id
    ) s;

    select coalesce(array_agg(id order by id), '{}')::uuid[]
      into v_correct_opts
    from public.quiz_options
    where question_id = v_q.id and is_correct = true;

    v_is_correct := v_selected = v_correct_opts;
    if v_is_correct then v_correct := v_correct + 1; end if;

    v_corrections := v_corrections || jsonb_build_object(
      'question_id', v_q.id,
      'is_correct', v_is_correct,
      'correct_option_ids', to_jsonb(v_correct_opts)
    );
  end loop;

  v_pct := round(100.0 * v_correct / v_total);

  insert into public.quiz_attempts (quiz_id, user_id, score_pct, correct_count, total_count)
  values (p_quiz_id, v_user, v_pct, v_correct, v_total);

  return jsonb_build_object(
    'score_pct', v_pct,
    'correct_count', v_correct,
    'total_count', v_total,
    'corrections', v_corrections
  );
end;
$$;


ALTER FUNCTION "public"."submit_quiz_attempt"("p_quiz_id" "uuid", "p_answers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_bookmark"("p_post_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.bookmarks where post_id = p_post_id and user_id = v_user) then
    delete from public.bookmarks where post_id = p_post_id and user_id = v_user;
    return false;
  else
    insert into public.bookmarks (post_id, user_id) values (p_post_id, v_user);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_bookmark"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_comment_like"("p_comment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.comment_likes where comment_id = p_comment_id and user_id = v_user) then
    delete from public.comment_likes where comment_id = p_comment_id and user_id = v_user;
    return false;
  else
    insert into public.comment_likes (comment_id, user_id) values (p_comment_id, v_user);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_comment_like"("p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_cours_follow"("p_kind" "text", "p_code" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('subject', 'level') then raise exception 'Invalid kind'; end if;

  if exists (
    select 1 from public.cours_follows
    where user_id = v_user and kind = p_kind and code = p_code
  ) then
    delete from public.cours_follows
    where user_id = v_user and kind = p_kind and code = p_code;
    return false;
  else
    insert into public.cours_follows (user_id, kind, code)
    values (v_user, p_kind, p_code);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_cours_follow"("p_kind" "text", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_like"("p_post_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_liked boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.likes where post_id = p_post_id and user_id = v_user) then
    delete from public.likes where post_id = p_post_id and user_id = v_user;
    return false;
  else
    insert into public.likes (post_id, user_id) values (p_post_id, v_user);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_like"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_listing_bookmark"("p_listing_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.listing_bookmarks where listing_id = p_listing_id and user_id = v_user) then
    delete from public.listing_bookmarks where listing_id = p_listing_id and user_id = v_user;
    return false;
  else
    insert into public.listing_bookmarks (listing_id, user_id) values (p_listing_id, v_user);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_listing_bookmark"("p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_resource_bookmark"("p_resource_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if exists (
    select 1 from public.resource_bookmarks
    where resource_id = p_resource_id and user_id = v_user
  ) then
    delete from public.resource_bookmarks
    where resource_id = p_resource_id and user_id = v_user;
    return false;
  else
    insert into public.resource_bookmarks (resource_id, user_id)
    values (p_resource_id, v_user);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_resource_bookmark"("p_resource_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_username"("p_username" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_current_username text;
  v_changed_at timestamptz;
  v_reserved text[] := array[
    'admin', 'administrator', 'root', 'sudo', 'system', 'staff', 'moderator', 'mod',
    'support', 'helpdesk', 'help', 'contact', 'feedback', 'abuse', 'report',
    'api', 'app', 'www', 'mail', 'email', 'null', 'undefined', 'true', 'false',
    'anonymous', 'deleted', 'doumassi', 'doumassiapp', 'doumassi_app',
    'doumassi_official', 'doumassi_team', 'official', 'team',
    'ceo', 'founder', 'owner', 'me', 'you', 'user', 'users', 'guest'
  ];
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_username is null or length(v_username) < 3 or length(v_username) > 30 then
    raise exception 'Username must be between 3 and 30 characters';
  end if;
  if v_username !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Username must start with a letter and contain only letters, numbers and underscores';
  end if;
  if right(v_username, 1) = '_' then
    raise exception 'Username cannot end with an underscore';
  end if;
  if v_username ~ '^user_[0-9a-f]{8}$' then
    raise exception 'This username format is reserved';
  end if;
  if v_username = any(v_reserved) then
    raise exception 'This username is reserved';
  end if;

  select username, username_changed_at
  into v_current_username, v_changed_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then raise exception 'Profile not found'; end if;

  -- IDEMPOTENT : NO-OP si username inchangé, sans déclencher le cooldown
  if lower(coalesce(v_current_username, '')) = v_username then
    return;
  end if;

  if v_changed_at is not null and v_changed_at > now() - interval '30 days' then
    raise exception 'You can change your username again on %',
      to_char((v_changed_at + interval '30 days')::date, 'YYYY-MM-DD');
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = v_username and id <> v_user_id
  ) then
    raise exception 'This username is already taken';
  end if;

  update public.profiles
  set username = v_username, username_changed_at = now(), updated_at = now()
  where id = v_user_id;
end;
$_$;


ALTER FUNCTION "public"."update_username"("p_username" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_username"("p_username" "text") IS 'Met à jour le username avec validation complète (format, réservés, unicité, cooldown 30j).
   Codes d erreur : UNAUTHENTICATED, PROFILE_NOT_FOUND, INVALID_FORMAT, RESERVED_PATTERN,
   RESERVED_NAME, ALREADY_TAKEN, COOLDOWN (avec jours restants).
   Migration 26 — mai 2026';



CREATE OR REPLACE FUNCTION "public"."wallet_claim_daily"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user     uuid := auth.uid();
  v_key      text;
  v_existing bigint;
  v_balance  bigint;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_key := 'daily:' || v_user::text || ':'
           || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');

  select balance_after into v_existing
  from public.wallet_transactions
  where user_id = v_user and idempotency_key = v_key;

  if found then
    select balance into v_balance from public.wallets where user_id = v_user;
    return jsonb_build_object('granted', false, 'amount', 0, 'balance', v_balance);
  end if;

  -- [BARÈME] connexion quotidienne = 10
  v_balance := public._wallet_reward(
    v_user, 10, v_key, jsonb_build_object('reason', 'daily_login')
  );

  return jsonb_build_object('granted', true, 'amount', 10, 'balance', v_balance);
end;
$$;


ALTER FUNCTION "public"."wallet_claim_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_grant"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_type" "public"."wallet_transaction_type" DEFAULT 'grant'::"public"."wallet_transaction_type", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user is null then raise exception 'p_user requis'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide : doit être > 0'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency_key requis'; end if;
  if p_type not in ('grant', 'reward', 'topup', 'refund', 'adjustment') then
    raise exception 'Type invalide pour un grant : %', p_type;
  end if;
  return public._wallet_apply(p_user, p_amount, p_type, p_idempotency_key, null, null, null, p_metadata);
end;
$$;


ALTER FUNCTION "public"."wallet_grant"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_type" "public"."wallet_transaction_type", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_spend"("p_amount" bigint, "p_idempotency_key" "text", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide : doit être > 0'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency_key requis'; end if;
  return public._wallet_apply(
    v_user, -p_amount, 'purchase', p_idempotency_key,
    null, p_reference_type, p_reference_id, p_metadata
  );
end;
$$;


ALTER FUNCTION "public"."wallet_spend"("p_amount" bigint, "p_idempotency_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_transactions_no_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'wallet_transactions est append-only : UPDATE interdit (utiliser une ligne de type adjustment)';
end;
$$;


ALTER FUNCTION "public"."wallet_transactions_no_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_transfer"("p_to_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_is_tip" boolean DEFAULT false, "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user        uuid := auth.uid();
  v_out_type    public.wallet_transaction_type;
  v_in_type     public.wallet_transaction_type;
  v_existing    bigint;
  v_new_balance bigint;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_to_user is null then raise exception 'Destinataire requis'; end if;
  if p_to_user = v_user then raise exception 'Transfert vers soi-même interdit'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide : doit être > 0'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency_key requis'; end if;
  if not exists (select 1 from public.wallets where user_id = p_to_user) then
    raise exception 'Destinataire introuvable';
  end if;

  v_out_type := case when p_is_tip then 'tip_out' else 'transfer_out' end;
  v_in_type  := case when p_is_tip then 'tip_in'  else 'transfer_in'  end;

  -- Verrou déterministe anti-deadlock (user_id croissant)
  if v_user < p_to_user then
    perform 1 from public.wallets where user_id = v_user    for update;
    perform 1 from public.wallets where user_id = p_to_user for update;
  else
    perform 1 from public.wallets where user_id = p_to_user for update;
    perform 1 from public.wallets where user_id = v_user    for update;
  end if;

  -- Idempotence décidée UNE SEULE FOIS au niveau du transfert (leg émetteur)
  select balance_after into v_existing
  from public.wallet_transactions
  where user_id = v_user and idempotency_key = p_idempotency_key;

  if found then
    return v_existing;  -- transfert déjà appliqué : no-op des deux côtés
  end if;

  -- Débit émetteur
  v_new_balance := public._wallet_apply(
    v_user, -p_amount, v_out_type, p_idempotency_key,
    p_to_user, p_reference_type, p_reference_id
  );

  -- Crédit récepteur — clé DÉRIVÉE et namespacée
  -- '<clé>:in:<émetteur>' → collision structurellement impossible
  -- tout en gardant la neutralisation déterministe des retries
  perform public._wallet_apply(
    p_to_user, p_amount, v_in_type,
    p_idempotency_key || ':in:' || v_user::text,
    v_user, p_reference_type, p_reference_id
  );

  return v_new_balance;
end;
$$;


ALTER FUNCTION "public"."wallet_transfer"("p_to_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_is_tip" boolean, "p_reference_type" "text", "p_reference_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text",
    "category" "public"."ai_conversation_category" DEFAULT 'general'::"public"."ai_conversation_category" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "public"."ai_message_role" NOT NULL,
    "content" "text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "tool_calls" "jsonb" DEFAULT '[]'::"jsonb",
    "tokens_input" integer DEFAULT 0,
    "tokens_output" integer DEFAULT 0,
    "model_used" "text",
    "cost_usd" numeric(10,6) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_messages"."cost_usd" IS 'Coût estimé en USD pour monitoring PostHog et alertes';



CREATE TABLE IF NOT EXISTS "public"."ai_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "requests_count" integer DEFAULT 0 NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "images_generated" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."ai_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "int_value" integer,
    "text_value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_config" IS 'Config applicative modifiable sans release (ex. seuils de modération). Écriture admin only.';



CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "blocker_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocks_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."blocks" IS 'Blocages - masquage bilatéral appliqué via les RLS policies';



CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "initiator_id" "uuid" NOT NULL,
    "daily_room_url" "text" NOT NULL,
    "daily_room_name" "text",
    "is_video" boolean DEFAULT true NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "call_type" "public"."call_type",
    "status" "public"."call_status" DEFAULT 'ringing'::"public"."call_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "parent_comment_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "like_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "comments_content_check" CHECK (("length"("content") <= 300))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "muted_at" timestamp with time zone,
    CONSTRAINT "conversation_participants_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "is_group" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "created_by" "uuid",
    "last_message_preview" "text",
    "last_message_sender_id" "uuid",
    CONSTRAINT "conversations_group_has_name" CHECK ((("is_group" = false) OR (("is_group" = true) AND ("name" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "name")) > 0))))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cours_follows" (
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cours_follows_kind_check" CHECK (("kind" = ANY (ARRAY['subject'::"text", 'level'::"text"])))
);


ALTER TABLE "public"."cours_follows" OWNER TO "postgres";


COMMENT ON TABLE "public"."cours_follows" IS 'E9-14 — Suivis matière/niveau de la verticale Cours (fil personnalisé).';



CREATE TABLE IF NOT EXISTS "public"."course_levels" (
    "code" "text" NOT NULL,
    "cycle" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."course_levels" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_levels" IS 'E9-01 — Référentiel des niveaux Cours (groupés par cycle). Écriture admin only.';



CREATE TABLE IF NOT EXISTS "public"."course_subjects" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."course_subjects" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_subjects" IS 'E9-01 — Référentiel des matières/domaines Cours. Écriture admin only.';



CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    "scheduled_delete_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "cancelled_at" timestamp with time zone,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "followed_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'accepted'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "followed_id")),
    CONSTRAINT "follows_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


COMMENT ON TABLE "public"."follows" IS 'Relations follower → followed. Status pending si followed a is_private=true';



CREATE TABLE IF NOT EXISTS "public"."game_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "game_id" "text" NOT NULL,
    "score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."game_scores" IS 'E10-01 — Scores des mini-jeux (game_id = id du registry app). Meilleur score dérivé.';



CREATE TABLE IF NOT EXISTS "public"."likes" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_bookmarks" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."listing_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "category" "public"."listing_category" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price_cents" integer,
    "currency" "text" DEFAULT 'EUR'::"text",
    "images" "text"[] DEFAULT ARRAY[]::"text"[],
    "location" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "badge" "text",
    "discount_percent" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "condition" "text",
    "boosted_until" timestamp with time zone,
    CONSTRAINT "listings_badge_check" CHECK (("badge" = ANY (ARRAY['offre_speciale'::"text", 'nouveaute'::"text", 'recommandation'::"text"]))),
    CONSTRAINT "listings_condition_check" CHECK (("condition" = ANY (ARRAY['neuf'::"text", 'tres_bon_etat'::"text", 'bon_etat'::"text", 'occasion'::"text"]))),
    CONSTRAINT "listings_currency_check" CHECK (("currency" = ANY (ARRAY['EUR'::"text", 'USD'::"text", 'GBP'::"text", 'XOF'::"text"]))),
    CONSTRAINT "listings_description_check" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "listings_discount_percent_check" CHECK ((("discount_percent" >= 0) AND ("discount_percent" <= 99))),
    CONSTRAINT "listings_images_check" CHECK ((("array_length"("images", 1) IS NULL) OR ("array_length"("images", 1) <= 5))),
    CONSTRAINT "listings_price_cents_check" CHECK (("price_cents" >= 0)),
    CONSTRAINT "listings_title_check" CHECK ((("length"("title") >= 3) AND ("length"("title") <= 100)))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


COMMENT ON TABLE "public"."listings" IS 'Produits et services du marketplace. MVP Niveau 1 : pas de paiement, bouton Acheter → DM vendeur.';



COMMENT ON COLUMN "public"."listings"."boosted_until" IS 'E12-09 — mise en avant payée en Dcoins active tant que > now(). Voir boost_listing.';



CREATE TABLE IF NOT EXISTS "public"."matching_intent_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intent_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matching_intent_reports_reason_check" CHECK (("reason" = ANY (ARRAY['inapproprie'::"text", 'spam'::"text", 'faux_profil'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."matching_intent_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."matching_intent_reports" IS 'E13-07 — signalements d''intentions de mise en relation. Désactivation auto au seuil (app_config).';



CREATE TABLE IF NOT EXISTS "public"."matching_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "subject_code" "text",
    "level_code" "text",
    "tags" "text"[],
    "note" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matching_intents_direction_check" CHECK (("direction" = ANY (ARRAY['cherche'::"text", 'propose'::"text"]))),
    CONSTRAINT "matching_intents_domain_check" CHECK (("domain" = ANY (ARRAY['scolaire'::"text", 'business'::"text"]))),
    CONSTRAINT "matching_intents_domain_fields" CHECK (((("domain" = 'scolaire'::"text") AND ("subject_code" IS NOT NULL)) OR (("domain" = 'business'::"text") AND ("tags" IS NOT NULL) AND ("array_length"("tags", 1) >= 1))))
);


ALTER TABLE "public"."matching_intents" OWNER TO "postgres";


COMMENT ON TABLE "public"."matching_intents" IS 'E13-03 — intentions de mise en relation (scolaire | business). Découverte via get_matching_candidates uniquement.';



COMMENT ON COLUMN "public"."matching_intents"."level_code" IS 'Niveau scolaire ; NULL = tous niveaux.';



COMMENT ON COLUMN "public"."matching_intents"."tags" IS 'Volet business : compétences/secteurs en texte libre (v1, sans taxonomie).';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "content" "text",
    "attachment_url" "text",
    "attachment_type" "public"."message_attachment_type",
    "attachment_duration_seconds" integer,
    "reply_to_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "reply_to_id" "uuid",
    "edited_at" timestamp with time zone,
    CONSTRAINT "messages_check" CHECK ((("content" IS NOT NULL) OR ("attachment_url" IS NOT NULL)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "public"."notification_type" NOT NULL,
    "entity_type" "public"."entity_type",
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_seen" boolean DEFAULT false NOT NULL,
    "payload" "jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Notifications in-app. Push envoyé via expo-notifications en parallèle.';



CREATE TABLE IF NOT EXISTS "public"."post_embeddings" (
    "post_id" "uuid" NOT NULL,
    "embedding" "public"."vector"(1536),
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "content" "text" NOT NULL,
    "image_url" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "media_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "media_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "share_count" integer DEFAULT 0 NOT NULL,
    "bookmark_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "posts_content_check" CHECK (("length"("content") <= 500)),
    CONSTRAINT "posts_media_type_check" CHECK (("media_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."posts" IS 'Posts texte + image optionnelle. Soft delete via deleted_at.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "cover_url" "text",
    "link_url" "text",
    "phone_number" "text",
    "is_private" boolean DEFAULT false NOT NULL,
    "interests" "text"[] DEFAULT ARRAY[]::"text"[],
    "language" "text" DEFAULT 'fr'::"text" NOT NULL,
    "push_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "full_name" "text",
    "birthday" "date",
    "is_professional" boolean DEFAULT false NOT NULL,
    "gender" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "username_changed_at" timestamp with time zone,
    "is_verified" boolean DEFAULT false,
    "cgv_accepted_at" timestamp with time zone,
    "cgv_version" "text",
    "matching_opt_in" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_bio_check" CHECK (("length"("bio") <= 250)),
    CONSTRAINT "profiles_display_name_check" CHECK ((("length"("display_name") >= 1) AND ("length"("display_name") <= 50))),
    CONSTRAINT "profiles_full_name_length" CHECK (("length"("full_name") <= 100)),
    CONSTRAINT "profiles_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"])))),
    CONSTRAINT "profiles_username_check" CHECK (((("length"("username") >= 3) AND ("length"("username") <= 30)) AND ("username" ~ '^[a-zA-Z0-9_]+$'::"text")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Profils utilisateurs - 1-to-1 avec auth.users';



COMMENT ON COLUMN "public"."profiles"."is_private" IS 'Si true, les posts et stories ne sont visibles qu''aux followers acceptés';



COMMENT ON COLUMN "public"."profiles"."interests" IS 'Centres d''intérêt (5-10) utilisés pour les embeddings de reco';



COMMENT ON COLUMN "public"."profiles"."full_name" IS 'Prénom + nom réel de l''utilisateur (peut rester privé)';



COMMENT ON COLUMN "public"."profiles"."birthday" IS 'Date de naissance — utilisée pour vérification d''âge et personnalisation';



COMMENT ON COLUMN "public"."profiles"."is_professional" IS 'Compte professionnel : accès aux outils Pro (badge, analytics, promotion de contenu)';



COMMENT ON COLUMN "public"."profiles"."gender" IS 'Genre de l''utilisateur — optionnel. Valeurs : male, female, other.';



COMMENT ON COLUMN "public"."profiles"."onboarding_completed" IS 'Flag explicite indiquant que l''utilisateur a terminé (ou skippé) le flow d''onboarding.
   Utilisé par useAuthGuard pour décider si l''user doit être redirigé vers /(onboarding) ou /(feed).
   Set à true quand l''user clique Continue OU Skip for now sur les écrans Complete profile et Cover photo.';



COMMENT ON COLUMN "public"."profiles"."username_changed_at" IS 'Date du dernier changement de username. NULL = jamais changé.
   Utilisé par la RPC update_username pour appliquer le cooldown de 30 jours.';



COMMENT ON COLUMN "public"."profiles"."cgv_accepted_at" IS 'Date d''acceptation des CGU/CGV. NULL = pas encore acceptées.';



COMMENT ON COLUMN "public"."profiles"."cgv_version" IS 'Version des CGU/CGV acceptées (ex: "1.0", "1.2"). Permet de re-demander l''acceptation si version change.';



COMMENT ON COLUMN "public"."profiles"."matching_opt_in" IS 'E13-03 — visible dans la mise en relation. FALSE par défaut (opt-in explicite, ADR-008 §2.7).';



CREATE TABLE IF NOT EXISTS "public"."quiz_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "score_pct" integer NOT NULL,
    "correct_count" integer NOT NULL,
    "total_count" integer NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quiz_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "label" "text" NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."quiz_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "prompt" "text" NOT NULL,
    "type" "text" NOT NULL,
    CONSTRAINT "quiz_questions_type_check" CHECK (("type" = ANY (ARRAY['single'::"text", 'multiple'::"text", 'boolean'::"text"])))
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "resource_id" "uuid",
    "level_code" "text" NOT NULL,
    "subject_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "question_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quizzes" OWNER TO "postgres";


COMMENT ON TABLE "public"."quizzes" IS 'E9-10 — Quiz (QCM/vrai-faux), optionnellement lié à une ressource.';



CREATE TABLE IF NOT EXISTS "public"."resource_bookmarks" (
    "resource_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resource_bookmarks" OWNER TO "postgres";


COMMENT ON TABLE "public"."resource_bookmarks" IS 'E9-02 — Favoris ressources (table dédiée, cf brief §15.2).';



CREATE TABLE IF NOT EXISTS "public"."resource_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resource_comments_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 2000)))
);


ALTER TABLE "public"."resource_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."resource_comments" IS 'E9-16 — Commentaires/entraide sous les ressources Cours (table dédiée).';



CREATE TABLE IF NOT EXISTS "public"."resource_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resource_reports_reason_check" CHECK (("reason" = ANY (ARRAY['inapproprie'::"text", 'fausse_info'::"text", 'spam'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."resource_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."resource_reports" IS 'E9-08 — Signalements de ressources. Insertion via RPC report_resource uniquement.';



CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "level_code" "text" NOT NULL,
    "subject_code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "files" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "report_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resources_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'reported'::"text", 'hidden'::"text"]))),
    CONSTRAINT "resources_type_check" CHECK (("type" = ANY (ARRAY['cours'::"text", 'fiche_revision'::"text", 'exercices'::"text", 'annale'::"text"])))
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


COMMENT ON TABLE "public"."resources" IS 'E9-02 — Ressources pédagogiques UGC (cours/fiches/exos/annales). Quiz = objet séparé.';



CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "media_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "duration_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "media_type" "text" DEFAULT 'video'::"text" NOT NULL,
    CONSTRAINT "stories_duration_seconds_check" CHECK ((("duration_seconds" >= 1) AND ("duration_seconds" <= 60))),
    CONSTRAINT "stories_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_views" (
    "story_id" "uuid" NOT NULL,
    "viewer_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_interest_embeddings" (
    "user_id" "uuid" NOT NULL,
    "embedding" "public"."vector"(1536),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_interest_embeddings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_interest_embeddings" IS 'Un embedding par user, calculé depuis profiles.interests, utilisé pour la reco feed Pour Toi';



CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "type" "public"."wallet_transaction_type" NOT NULL,
    "counterparty_user_id" "uuid",
    "reference_type" "text",
    "reference_id" "uuid",
    "idempotency_key" "text" NOT NULL,
    "balance_after" bigint NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_transactions_amount_check" CHECK (("amount" <> 0)),
    CONSTRAINT "wallet_transactions_balance_after_check" CHECK (("balance_after" >= 0))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallet_transactions" IS 'E12-01 — Grand livre Dcoins, append-only. amount signé (+ crédit / - débit). Source de vérité du solde.';



COMMENT ON COLUMN "public"."wallet_transactions"."amount" IS 'Montant SIGNÉ en Dcoins : positif = crédit, négatif = débit. Jamais 0.';



COMMENT ON COLUMN "public"."wallet_transactions"."idempotency_key" IS 'Anti double-dépense : un retry réseau réutilise la clé => refusé par l''unique (user_id, idempotency_key).';



COMMENT ON COLUMN "public"."wallet_transactions"."balance_after" IS 'Solde du user APRÈS cette transaction (auditabilité : rejouer le ledger).';



CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "user_id" "uuid" NOT NULL,
    "balance" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallets_balance_check" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallets" IS 'E12-01 — Solde Dcoins par user. Cache maintenu atomiquement par les RPC wallet_* ; source de vérité = wallet_transactions.';



COMMENT ON COLUMN "public"."wallets"."balance" IS 'Solde en Dcoins (entier). CHECK >= 0 : ne peut jamais devenir négatif.';



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("user_id", "post_id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cours_follows"
    ADD CONSTRAINT "cours_follows_pkey" PRIMARY KEY ("user_id", "kind", "code");



ALTER TABLE ONLY "public"."course_levels"
    ADD CONSTRAINT "course_levels_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."course_subjects"
    ADD CONSTRAINT "course_subjects_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "followed_id");



ALTER TABLE ONLY "public"."game_scores"
    ADD CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("user_id", "post_id");



ALTER TABLE ONLY "public"."listing_bookmarks"
    ADD CONSTRAINT "listing_bookmarks_pkey" PRIMARY KEY ("user_id", "listing_id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_intent_reports"
    ADD CONSTRAINT "matching_intent_reports_intent_id_reporter_id_key" UNIQUE ("intent_id", "reporter_id");



ALTER TABLE ONLY "public"."matching_intent_reports"
    ADD CONSTRAINT "matching_intent_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_intents"
    ADD CONSTRAINT "matching_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_embeddings"
    ADD CONSTRAINT "post_embeddings_pkey" PRIMARY KEY ("post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_options"
    ADD CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_bookmarks"
    ADD CONSTRAINT "resource_bookmarks_pkey" PRIMARY KEY ("resource_id", "user_id");



ALTER TABLE ONLY "public"."resource_comments"
    ADD CONSTRAINT "resource_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_reports"
    ADD CONSTRAINT "resource_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_reports"
    ADD CONSTRAINT "resource_reports_resource_id_reporter_id_key" UNIQUE ("resource_id", "reporter_id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_pkey" PRIMARY KEY ("story_id", "viewer_id");



ALTER TABLE ONLY "public"."user_interest_embeddings"
    ADD CONSTRAINT "user_interest_embeddings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "deletion_requests_scheduled_idx" ON "public"."deletion_requests" USING "btree" ("scheduled_delete_at") WHERE (("cancelled_at" IS NULL) AND ("processed_at" IS NULL));



CREATE INDEX "idx_ai_conv_user" ON "public"."ai_conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_ai_msg_conv" ON "public"."ai_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_blocks_blocked" ON "public"."blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_bookmarks_post" ON "public"."bookmarks" USING "btree" ("post_id");



CREATE INDEX "idx_bookmarks_user" ON "public"."bookmarks" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_calls_active" ON "public"."calls" USING "btree" ("conversation_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_calls_conv" ON "public"."calls" USING "btree" ("conversation_id", "started_at" DESC);



CREATE INDEX "idx_calls_conversation_created" ON "public"."calls" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_calls_initiator" ON "public"."calls" USING "btree" ("initiator_id");



CREATE INDEX "idx_comments_author" ON "public"."comments" USING "btree" ("author_id");



CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_comment_id") WHERE ("parent_comment_id" IS NOT NULL);



CREATE INDEX "idx_comments_post" ON "public"."comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "idx_conv_last_message" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversation_participants_user" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_cp_user" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_follows_followed" ON "public"."follows" USING "btree" ("followed_id");



CREATE INDEX "idx_follows_follower" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_pending" ON "public"."follows" USING "btree" ("followed_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_game_scores_game_score" ON "public"."game_scores" USING "btree" ("game_id", "score" DESC);



CREATE INDEX "idx_game_scores_user_game" ON "public"."game_scores" USING "btree" ("user_id", "game_id");



CREATE INDEX "idx_likes_post" ON "public"."likes" USING "btree" ("post_id");



CREATE INDEX "idx_listing_bookmarks_listing" ON "public"."listing_bookmarks" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_bookmarks_user" ON "public"."listing_bookmarks" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_listings_boosted_active" ON "public"."listings" USING "btree" ("boosted_until" DESC) WHERE ("boosted_until" IS NOT NULL);



CREATE INDEX "idx_listings_category_active" ON "public"."listings" USING "btree" ("category", "created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_listings_popular" ON "public"."listings" USING "btree" ("view_count" DESC, "created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_listings_seller" ON "public"."listings" USING "btree" ("seller_id");



CREATE INDEX "idx_listings_title_trgm" ON "public"."listings" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_matching_intent_reports_intent" ON "public"."matching_intent_reports" USING "btree" ("intent_id");



CREATE INDEX "idx_matching_intents_scolaire" ON "public"."matching_intents" USING "btree" ("domain", "direction", "subject_code", "level_code") WHERE ("is_active" = true);



CREATE INDEX "idx_matching_intents_tags" ON "public"."matching_intents" USING "gin" ("tags") WHERE ("is_active" = true);



CREATE INDEX "idx_matching_intents_user" ON "public"."matching_intents" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_reply_to" ON "public"."messages" USING "btree" ("reply_to_message_id") WHERE ("reply_to_message_id" IS NOT NULL);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_msg_conv" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_msg_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_notif_actor" ON "public"."notifications" USING "btree" ("actor_id") WHERE ("actor_id" IS NOT NULL);



CREATE INDEX "idx_notif_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notif_unread" ON "public"."notifications" USING "btree" ("recipient_id") WHERE ("is_read" = false);



CREATE INDEX "idx_post_emb_cosine" ON "public"."post_embeddings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_posts_author" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_content_trgm" ON "public"."posts" USING "gin" ("content" "public"."gin_trgm_ops");



CREATE INDEX "idx_posts_feed" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_profiles_display_name_trgm" ON "public"."profiles" USING "gin" ("display_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_profiles_username_lower" ON "public"."profiles" USING "btree" ("lower"("username"));



CREATE INDEX "idx_profiles_username_trgm" ON "public"."profiles" USING "gin" ("username" "public"."gin_trgm_ops");



CREATE INDEX "idx_quiz_attempts_user_quiz" ON "public"."quiz_attempts" USING "btree" ("user_id", "quiz_id");



CREATE INDEX "idx_quiz_options_question" ON "public"."quiz_options" USING "btree" ("question_id", "position");



CREATE INDEX "idx_quiz_questions_quiz" ON "public"."quiz_questions" USING "btree" ("quiz_id", "position");



CREATE INDEX "idx_quizzes_level_subject" ON "public"."quizzes" USING "btree" ("level_code", "subject_code");



CREATE INDEX "idx_quizzes_resource" ON "public"."quizzes" USING "btree" ("resource_id");



CREATE INDEX "idx_resource_comments_resource" ON "public"."resource_comments" USING "btree" ("resource_id", "created_at" DESC);



CREATE INDEX "idx_resources_created_at" ON "public"."resources" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_resources_level_subject" ON "public"."resources" USING "btree" ("level_code", "subject_code");



CREATE INDEX "idx_stories_author_expires" ON "public"."stories" USING "btree" ("author_id", "expires_at" DESC);



CREATE INDEX "idx_stories_expires" ON "public"."stories" USING "btree" ("expires_at");



CREATE INDEX "idx_story_views_viewer" ON "public"."story_views" USING "btree" ("viewer_id", "viewed_at" DESC);



CREATE INDEX "idx_wallet_transactions_user_created" ON "public"."wallet_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "notifications_recipient_created_idx" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "notifications_unseen_idx" ON "public"."notifications" USING "btree" ("recipient_id") WHERE ("is_seen" = false);



CREATE INDEX "profiles_display_name_trgm_idx" ON "public"."profiles" USING "gin" ("display_name" "public"."gin_trgm_ops");



CREATE INDEX "profiles_username_trgm_idx" ON "public"."profiles" USING "gin" ("username" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "profiles_username_unique_lower_idx" ON "public"."profiles" USING "btree" ("lower"("username"));



CREATE UNIQUE INDEX "uq_wallet_transactions_user_idempotency" ON "public"."wallet_transactions" USING "btree" ("user_id", "idempotency_key");



CREATE OR REPLACE TRIGGER "trg_ai_conversations_updated" BEFORE UPDATE ON "public"."ai_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comments_like_count" AFTER INSERT OR DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_comments_like_count"();



CREATE OR REPLACE TRIGGER "trg_comments_updated" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_conversations_updated" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_create_wallet_for_new_profile" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_wallet_for_new_profile"();



CREATE OR REPLACE TRIGGER "trg_enforce_dm_uniqueness" BEFORE INSERT ON "public"."conversation_participants" FOR EACH ROW EXECUTE FUNCTION "public"."fn_enforce_dm_uniqueness"();



CREATE OR REPLACE TRIGGER "trg_enforce_follow_rate_limit" BEFORE INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_follow_rate_limit"();



CREATE OR REPLACE TRIGGER "trg_enforce_min_age" BEFORE INSERT OR UPDATE OF "birthday" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_min_age"();



CREATE OR REPLACE TRIGGER "trg_listings_updated" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_messages_update_conv" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_last_message"();



CREATE OR REPLACE TRIGGER "trg_notify_comment" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_comment"();



CREATE OR REPLACE TRIGGER "trg_notify_follow" AFTER INSERT OR UPDATE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_follow"();



CREATE OR REPLACE TRIGGER "trg_notify_like" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_like"();



CREATE OR REPLACE TRIGGER "trg_notify_mention_comments" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_mention"();



CREATE OR REPLACE TRIGGER "trg_notify_mention_messages" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_mention"();



CREATE OR REPLACE TRIGGER "trg_notify_mention_posts" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_mention"();



CREATE OR REPLACE TRIGGER "trg_notify_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_message"();



CREATE OR REPLACE TRIGGER "trg_posts_bookmark_count" AFTER INSERT OR DELETE ON "public"."bookmarks" FOR EACH ROW EXECUTE FUNCTION "public"."fn_posts_bookmark_count"();



CREATE OR REPLACE TRIGGER "trg_posts_comment_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_posts_comment_count"();



CREATE OR REPLACE TRIGGER "trg_posts_like_count" AFTER INSERT OR DELETE ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_posts_like_count"();



CREATE OR REPLACE TRIGGER "trg_posts_updated" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_push_on_notification_insert" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trigger_push_notification"();



CREATE OR REPLACE TRIGGER "trg_recalc_conv_last_message_on_delete" AFTER UPDATE OF "deleted_at" ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_recalc_conversation_last_message_on_delete"();



CREATE OR REPLACE TRIGGER "trg_reward_course_publish" AFTER INSERT ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."reward_course_publish"();



CREATE OR REPLACE TRIGGER "trg_reward_quiz_pass" AFTER INSERT ON "public"."quiz_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."reward_quiz_pass"();



CREATE OR REPLACE TRIGGER "trg_update_conversation_last_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_conversation_last_message"();



CREATE OR REPLACE TRIGGER "trg_wallet_transactions_no_update" BEFORE UPDATE ON "public"."wallet_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."wallet_transactions_no_update"();



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_rate_limits"
    ADD CONSTRAINT "ai_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_last_message_sender_id_fkey" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cours_follows"
    ADD CONSTRAINT "cours_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_scores"
    ADD CONSTRAINT "game_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_bookmarks"
    ADD CONSTRAINT "listing_bookmarks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_bookmarks"
    ADD CONSTRAINT "listing_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matching_intent_reports"
    ADD CONSTRAINT "matching_intent_reports_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "public"."matching_intents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matching_intent_reports"
    ADD CONSTRAINT "matching_intent_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matching_intents"
    ADD CONSTRAINT "matching_intents_level_code_fkey" FOREIGN KEY ("level_code") REFERENCES "public"."course_levels"("code");



ALTER TABLE ONLY "public"."matching_intents"
    ADD CONSTRAINT "matching_intents_subject_code_fkey" FOREIGN KEY ("subject_code") REFERENCES "public"."course_subjects"("code");



ALTER TABLE ONLY "public"."matching_intents"
    ADD CONSTRAINT "matching_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_embeddings"
    ADD CONSTRAINT "post_embeddings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_options"
    ADD CONSTRAINT "quiz_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_level_code_fkey" FOREIGN KEY ("level_code") REFERENCES "public"."course_levels"("code");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_subject_code_fkey" FOREIGN KEY ("subject_code") REFERENCES "public"."course_subjects"("code");



ALTER TABLE ONLY "public"."resource_bookmarks"
    ADD CONSTRAINT "resource_bookmarks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_bookmarks"
    ADD CONSTRAINT "resource_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_comments"
    ADD CONSTRAINT "resource_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_comments"
    ADD CONSTRAINT "resource_comments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_reports"
    ADD CONSTRAINT "resource_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_reports"
    ADD CONSTRAINT "resource_reports_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_level_code_fkey" FOREIGN KEY ("level_code") REFERENCES "public"."course_levels"("code");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_subject_code_fkey" FOREIGN KEY ("subject_code") REFERENCES "public"."course_subjects"("code");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interest_embeddings"
    ADD CONSTRAINT "user_interest_embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_counterparty_user_id_fkey" FOREIGN KEY ("counterparty_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "ai_conv_delete_own" ON "public"."ai_conversations" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ai_conv_insert_own" ON "public"."ai_conversations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ai_conv_select_own" ON "public"."ai_conversations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ai_conv_update_own" ON "public"."ai_conversations" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_msg_insert_user_role" ON "public"."ai_messages" FOR INSERT WITH CHECK ((("role" = 'user'::"public"."ai_message_role") AND (EXISTS ( SELECT 1
   FROM "public"."ai_conversations" "c"
  WHERE (("c"."id" = "ai_messages"."conversation_id") AND ("c"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "ai_msg_select_own" ON "public"."ai_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations" "c"
  WHERE (("c"."id" = "ai_messages"."conversation_id") AND ("c"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."ai_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_rl_select_own" ON "public"."ai_rate_limits" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_config public read" ON "public"."app_config" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blocks_delete_own" ON "public"."blocks" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



CREATE POLICY "blocks_insert_own" ON "public"."blocks" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



CREATE POLICY "blocks_select_own" ON "public"."blocks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookmarks_delete_own" ON "public"."bookmarks" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "bookmarks_insert_own" ON "public"."bookmarks" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "bookmarks_select_own" ON "public"."bookmarks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calls insert if initiator and participant" ON "public"."calls" FOR INSERT TO "authenticated" WITH CHECK ((("initiator_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "calls"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "calls select if participant of conv" ON "public"."calls" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "calls"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "calls update status if participant" ON "public"."calls" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "calls"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "calls"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_likes delete own" ON "public"."comment_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "comment_likes insert own" ON "public"."comment_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "comment_likes select all" ON "public"."comment_likes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_own" ON "public"."comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "comments_insert_own" ON "public"."comments" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "author_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ("p"."deleted_at" IS NULL) AND "public"."can_see_content_of"("p"."author_id"))))));



CREATE POLICY "comments_select_visible" ON "public"."comments" FOR SELECT USING ((("deleted_at" IS NULL) AND (NOT "public"."is_blocked_with"("author_id")) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "comments"."post_id") AND ("p"."deleted_at" IS NULL) AND "public"."can_see_content_of"("p"."author_id"))))));



CREATE POLICY "comments_update_own" ON "public"."comments" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants delete own" ON "public"."conversation_participants" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "conversation_participants select if same conv" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING ("public"."fn_is_conversation_participant"("conversation_id"));



CREATE POLICY "conversation_participants update own last_read or muted" ON "public"."conversation_participants" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations select if participant" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "conversations update name if admin" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("conversation_participants"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("conversation_participants"."role" = 'admin'::"text")))));



ALTER TABLE "public"."cours_follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cours_follows delete own" ON "public"."cours_follows" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "cours_follows insert own" ON "public"."cours_follows" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "cours_follows select own" ON "public"."cours_follows" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."course_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_levels public read" ON "public"."course_levels" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."course_subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_subjects public read" ON "public"."course_subjects" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete_as_involved" ON "public"."follows" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "follower_id") OR (( SELECT "auth"."uid"() AS "uid") = "followed_id")));



CREATE POLICY "follows_insert_as_follower" ON "public"."follows" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "follower_id") AND (NOT "public"."is_blocked_with"("followed_id"))));



CREATE POLICY "follows_select_involved" ON "public"."follows" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "follower_id") OR (( SELECT "auth"."uid"() AS "uid") = "followed_id")));



CREATE POLICY "follows_update_status_as_followed" ON "public"."follows" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "followed_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "followed_id"));



ALTER TABLE "public"."game_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "game_scores public read" ON "public"."game_scores" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "likes_delete_own" ON "public"."likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "likes_insert_own" ON "public"."likes" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "likes"."post_id") AND ("p"."deleted_at" IS NULL) AND "public"."can_see_content_of"("p"."author_id"))))));



CREATE POLICY "likes_select_all" ON "public"."likes" FOR SELECT USING (((NOT "public"."is_blocked_with"("user_id")) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "likes"."post_id") AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."listing_bookmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listing_bookmarks_delete_own" ON "public"."listing_bookmarks" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "listing_bookmarks_insert_own" ON "public"."listing_bookmarks" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "listing_bookmarks_select_own" ON "public"."listing_bookmarks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listings_delete_own" ON "public"."listings" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "seller_id"));



CREATE POLICY "listings_insert_own" ON "public"."listings" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "seller_id"));



CREATE POLICY "listings_select_public" ON "public"."listings" FOR SELECT USING (((("is_active" = true) AND (NOT "public"."is_blocked_with"("seller_id"))) OR (( SELECT "auth"."uid"() AS "uid") = "seller_id")));



CREATE POLICY "listings_update_own" ON "public"."listings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "seller_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "seller_id"));



ALTER TABLE "public"."matching_intent_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matching_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_intents owner delete" ON "public"."matching_intents" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "matching_intents owner insert" ON "public"."matching_intents" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "matching_intents owner read" ON "public"."matching_intents" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "matching_intents owner update" ON "public"."matching_intents" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages insert if sender and participant" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "messages select if participant" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "messages update own (edit or soft-delete)" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("sender_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "post_emb_select_visible" ON "public"."post_embeddings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_embeddings"."post_id") AND ("p"."deleted_at" IS NULL) AND "public"."can_see_content_of"("p"."author_id")))));



ALTER TABLE "public"."post_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_own" ON "public"."posts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "posts_insert_own" ON "public"."posts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "posts_select_visibility" ON "public"."posts" FOR SELECT USING ((("deleted_at" IS NULL) AND "public"."can_view_post"("author_id")));



CREATE POLICY "posts_update_own" ON "public"."posts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_select_visible" ON "public"."profiles" FOR SELECT USING ((NOT "public"."is_blocked_with"("id")));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."quiz_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_attempts select own" ON "public"."quiz_attempts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."quiz_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quizzes public read" ON "public"."quizzes" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."resource_bookmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resource_bookmarks delete own" ON "public"."resource_bookmarks" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "resource_bookmarks insert own" ON "public"."resource_bookmarks" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "resource_bookmarks select own" ON "public"."resource_bookmarks" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."resource_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resource_comments delete own or resource owner" ON "public"."resource_comments" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."resources" "r"
  WHERE (("r"."id" = "resource_comments"."resource_id") AND ("r"."author_id" = "auth"."uid"()))))));



CREATE POLICY "resource_comments insert own" ON "public"."resource_comments" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "resource_comments public read" ON "public"."resource_comments" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."resource_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resources delete own" ON "public"."resources" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "resources insert own" ON "public"."resources" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "resources read active or own" ON "public"."resources" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"text") OR ("author_id" = "auth"."uid"())));



CREATE POLICY "resources update own" ON "public"."resources" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stories users insert own" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "stories_delete_own" ON "public"."stories" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "stories_insert_own" ON "public"."stories" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "stories_select_visible" ON "public"."stories" FOR SELECT USING ((("expires_at" > "now"()) AND "public"."can_see_content_of"("author_id")));



ALTER TABLE "public"."story_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "story_views_insert_as_viewer" ON "public"."story_views" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "viewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."stories" "s"
  WHERE (("s"."id" = "story_views"."story_id") AND ("s"."expires_at" > "now"()) AND "public"."can_see_content_of"("s"."author_id"))))));



CREATE POLICY "story_views_select_author_or_viewer" ON "public"."story_views" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "viewer_id") OR (EXISTS ( SELECT 1
   FROM "public"."stories" "s"
  WHERE (("s"."id" = "story_views"."story_id") AND ("s"."author_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "user_int_emb_select_own" ON "public"."user_interest_embeddings" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_interest_embeddings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can cancel their own deletion" ON "public"."deletion_requests" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can request their own deletion" ON "public"."deletion_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can see their own deletion request" ON "public"."deletion_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users see their own notifications" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



CREATE POLICY "users update their own notifications" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "recipient_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "recipient_id"));



ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_transactions owner read" ON "public"."wallet_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallets owner read" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_anonymize_user_profile"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_anonymize_user_profile"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_wallet_apply"("p_user" "uuid", "p_amount" bigint, "p_type" "public"."wallet_transaction_type", "p_idempotency_key" "text", "p_counterparty" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_wallet_apply"("p_user" "uuid", "p_amount" bigint, "p_type" "public"."wallet_transaction_type", "p_idempotency_key" "text", "p_counterparty" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_wallet_reward"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_wallet_reward"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_follow_request"("p_requester_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_follow_request"("p_requester_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_follow_request"("p_requester_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."boost_listing"("p_listing_id" "uuid", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."boost_listing"("p_listing_id" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."boost_listing"("p_listing_id" "uuid", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_see_content_of"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_see_content_of"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_see_content_of"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_post"("p_author_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_post"("p_author_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_post"("p_author_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_account_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_ai_rate_limit"("p_user_id" "uuid", "p_max_requests" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_comment"("p_post_id" "uuid", "p_content" "text", "p_parent_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_comment"("p_post_id" "uuid", "p_content" "text", "p_parent_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_comment"("p_post_id" "uuid", "p_content" "text", "p_parent_comment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_group_conversation"("p_name" "text", "p_participant_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_group_conversation"("p_name" "text", "p_participant_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_group_conversation"("p_name" "text", "p_participant_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_listing"("p_category" "text", "p_title" "text", "p_description" "text", "p_price_cents" integer, "p_currency" "text", "p_images" "text"[], "p_location" "text", "p_condition" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_listing"("p_category" "text", "p_title" "text", "p_description" "text", "p_price_cents" integer, "p_currency" "text", "p_images" "text"[], "p_location" "text", "p_condition" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_listing"("p_category" "text", "p_title" "text", "p_description" "text", "p_price_cents" integer, "p_currency" "text", "p_images" "text"[], "p_location" "text", "p_condition" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_quiz"("p_title" "text", "p_level_code" "text", "p_subject_code" "text", "p_questions" "jsonb", "p_resource_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_quiz"("p_title" "text", "p_level_code" "text", "p_subject_code" "text", "p_questions" "jsonb", "p_resource_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quiz"("p_title" "text", "p_level_code" "text", "p_subject_code" "text", "p_questions" "jsonb", "p_resource_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_resource"("p_type" "text", "p_level_code" "text", "p_subject_code" "text", "p_title" "text", "p_description" "text", "p_files" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_resource"("p_type" "text", "p_level_code" "text", "p_subject_code" "text", "p_title" "text", "p_description" "text", "p_files" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_resource"("p_type" "text", "p_level_code" "text", "p_subject_code" "text", "p_title" "text", "p_description" "text", "p_files" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_story_view"("p_story_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_story_view"("p_story_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_story_view"("p_story_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_wallet_for_new_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_wallet_for_new_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_wallet_for_new_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_comment"("p_comment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."end_call"("p_call_id" "uuid", "p_status" "public"."call_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_call"("p_call_id" "uuid", "p_status" "public"."call_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_call"("p_call_id" "uuid", "p_status" "public"."call_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_follow_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_follow_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_follow_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_min_age"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_min_age"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_min_age"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_comments_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_enforce_dm_uniqueness"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_extract_mentions"("p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_extract_mentions"("p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_extract_mentions"("p_content" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_is_conversation_participant"("p_conversation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_is_conversation_participant"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_conversation_participant"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_follow"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_mention"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_posts_bookmark_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_posts_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_posts_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalc_conversation_last_message_on_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_trigger_push_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_author_reputation"("p_author_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_author_reputation"("p_author_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_author_reputation"("p_author_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bookmarks"("p_cursor" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_bookmarks"("p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bookmarks"("p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_boosted_listings"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_boosted_listings"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_boosted_listings"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feed"("p_cursor" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed"("p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feed"("p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_followed_resources"("p_cursor" timestamp with time zone, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_followed_resources"("p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_followed_resources"("p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_game_leaderboard"("p_game_id" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_game_leaderboard"("p_game_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_game_leaderboard"("p_game_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_listing_detail"("p_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_listing_detail"("p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_listing_detail"("p_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_listings"("p_category" "text", "p_condition" "text", "p_min_price_cents" integer, "p_max_price_cents" integer, "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_listings"("p_category" "text", "p_condition" "text", "p_min_price_cents" integer, "p_max_price_cents" integer, "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_listings"("p_category" "text", "p_condition" "text", "p_min_price_cents" integer, "p_max_price_cents" integer, "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_best_game_score"("p_game_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_best_game_score"("p_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_best_game_score"("p_game_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_best_quiz_score"("p_quiz_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_best_quiz_score"("p_quiz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_best_quiz_score"("p_quiz_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_blocked_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_blocked_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_bookmarked_listings"("p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_conversations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_conversations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_cours_follows"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_cours_follows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_cours_follows"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_deletion_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_deletion_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_deletion_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_notifications"("p_filter" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_notifications"("p_filter" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notifications"("p_filter" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_dm"("p_other_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_dm"("p_other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_dm"("p_other_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_post_with_counts"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_with_counts"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_with_counts"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_quiz"("p_quiz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_quiz"("p_quiz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_quiz"("p_quiz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_resource_detail"("p_resource_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_resource_detail"("p_resource_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_resource_detail"("p_resource_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_resources"("p_level_code" "text", "p_subject_code" "text", "p_type" "text", "p_search" "text", "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_resources"("p_level_code" "text", "p_subject_code" "text", "p_type" "text", "p_search" "text", "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_resources"("p_level_code" "text", "p_subject_code" "text", "p_type" "text", "p_search" "text", "p_sort" "text", "p_cursor" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_similar_listings"("p_listing_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_similar_listings"("p_listing_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_similar_listings"("p_listing_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_stories_feed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_stories_feed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stories_feed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_story_viewers"("p_story_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_story_viewers"("p_story_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_story_viewers"("p_story_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_share_count"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_share_count"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_share_count"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_blocked_with"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_blocked_with"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_blocked_with"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_seen"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_seen"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_seen"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_follow_request"("p_requester_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_follow_request"("p_requester_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_follow_request"("p_requester_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_matching_intent"("p_intent_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_matching_intent"("p_intent_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_matching_intent"("p_intent_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_resource"("p_resource_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_resource"("p_resource_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_resource"("p_resource_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_account_deletion"("p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_account_deletion"("p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_account_deletion"("p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reward_course_publish"() TO "anon";
GRANT ALL ON FUNCTION "public"."reward_course_publish"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reward_course_publish"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reward_quiz_pass"() TO "anon";
GRANT ALL ON FUNCTION "public"."reward_quiz_pass"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reward_quiz_pass"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_users"("p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_users"("p_query" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_post"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_post"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_post"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_game_score"("p_game_id" "text", "p_score" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_game_score"("p_game_id" "text", "p_score" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_game_score"("p_game_id" "text", "p_score" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_quiz_attempt"("p_quiz_id" "uuid", "p_answers" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_quiz_attempt"("p_quiz_id" "uuid", "p_answers" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_quiz_attempt"("p_quiz_id" "uuid", "p_answers" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_bookmark"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_bookmark"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_bookmark"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_comment_like"("p_comment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_cours_follow"("p_kind" "text", "p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_cours_follow"("p_kind" "text", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_cours_follow"("p_kind" "text", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_like"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_like"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_like"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_listing_bookmark"("p_listing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_listing_bookmark"("p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_listing_bookmark"("p_listing_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_resource_bookmark"("p_resource_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_resource_bookmark"("p_resource_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_resource_bookmark"("p_resource_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_username"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_username"("p_username" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_claim_daily"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_claim_daily"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_claim_daily"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_grant"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_type" "public"."wallet_transaction_type", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_grant"("p_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_type" "public"."wallet_transaction_type", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_spend"("p_amount" bigint, "p_idempotency_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_spend"("p_amount" bigint, "p_idempotency_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_spend"("p_amount" bigint, "p_idempotency_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_transactions_no_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_transactions_no_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_transactions_no_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_transfer"("p_to_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_is_tip" boolean, "p_reference_type" "text", "p_reference_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_transfer"("p_to_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_is_tip" boolean, "p_reference_type" "text", "p_reference_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_transfer"("p_to_user" "uuid", "p_amount" bigint, "p_idempotency_key" "text", "p_is_tip" boolean, "p_reference_type" "text", "p_reference_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT ALL ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."cours_follows" TO "anon";
GRANT ALL ON TABLE "public"."cours_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."cours_follows" TO "service_role";



GRANT ALL ON TABLE "public"."course_levels" TO "anon";
GRANT ALL ON TABLE "public"."course_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."course_levels" TO "service_role";



GRANT ALL ON TABLE "public"."course_subjects" TO "anon";
GRANT ALL ON TABLE "public"."course_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."course_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."game_scores" TO "anon";
GRANT ALL ON TABLE "public"."game_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."game_scores" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."listing_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."listing_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."matching_intent_reports" TO "anon";
GRANT ALL ON TABLE "public"."matching_intent_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_intent_reports" TO "service_role";



GRANT ALL ON TABLE "public"."matching_intents" TO "anon";
GRANT ALL ON TABLE "public"."matching_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_intents" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."post_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."post_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."post_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_attempts" TO "anon";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_options" TO "anon";
GRANT ALL ON TABLE "public"."quiz_options" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_options" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_questions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT ALL ON TABLE "public"."quizzes" TO "anon";
GRANT ALL ON TABLE "public"."quizzes" TO "authenticated";
GRANT ALL ON TABLE "public"."quizzes" TO "service_role";



GRANT ALL ON TABLE "public"."resource_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."resource_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."resource_comments" TO "anon";
GRANT ALL ON TABLE "public"."resource_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_comments" TO "service_role";



GRANT ALL ON TABLE "public"."resource_reports" TO "anon";
GRANT ALL ON TABLE "public"."resource_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_reports" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."story_views" TO "anon";
GRANT ALL ON TABLE "public"."story_views" TO "authenticated";
GRANT ALL ON TABLE "public"."story_views" TO "service_role";



GRANT ALL ON TABLE "public"."user_interest_embeddings" TO "anon";
GRANT ALL ON TABLE "public"."user_interest_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interest_embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







