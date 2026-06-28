-- Seed the legacy server config without losing settings. Run after schema migrations.
-- Replace __CONFIG_JSON__ with contents of config_1413059459630104626.json if your SQL runner cannot read files.

insert into guilds (id, name) values ('1413059459630104626', 'Legacy Opus Server')
on conflict (id) do nothing;

-- psql example:
-- \set config_json `cat db/seed/config_1413059459630104626.json`
-- insert into server_configs (guild_id, product_type, config_data)
-- values ('1413059459630104626', 'ticket', :'config_json'::jsonb),
--        ('1413059459630104626', 'voice_rooms', :'config_json'::jsonb),
--        ('1413059459630104626', 'general', :'config_json'::jsonb)
-- on conflict (guild_id, product_type) do update set config_data = excluded.config_data, updated_at = now();
