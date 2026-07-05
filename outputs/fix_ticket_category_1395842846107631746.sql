-- Fix ticket category for guild 1395842846107631746
-- Error fixed: parent_id[CHANNEL_PARENT_INVALID]: Category does not exist

update server_configs
set config_data = jsonb_set(
  config_data::jsonb,
  '{guild,categoryId}',
  '"1523357377359908995"'::jsonb,
  true
)
where guild_id = '1395842846107631746'
  and product_type = 'ticket';
