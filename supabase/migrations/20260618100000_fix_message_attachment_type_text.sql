-- Fix DEV/legacy DB drift: text messages are sent with attachment_type = 'text'.
-- Some environments had message_attachment_type without this enum value.

alter type public.message_attachment_type add value if not exists 'text';
