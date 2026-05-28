-- E4-11: certains triggers de notifications appellent net.http_post.
-- pg_net cree le schema net requis par ces appels asynchrones.
create extension if not exists pg_net;
