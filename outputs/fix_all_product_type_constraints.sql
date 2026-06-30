-- يصلح كل قيود product_type في القاعدة دفعة وحدة عشان تتطابق مع القيم الحالية
-- (ticket, voice_rooms, general)

alter table server_configs drop constraint if exists server_configs_product_type_check;
alter table server_configs add constraint server_configs_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table token_pool drop constraint if exists token_pool_product_type_check;
alter table token_pool add constraint token_pool_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table bot_instances drop constraint if exists bot_instances_product_type_check;
alter table bot_instances add constraint bot_instances_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table subscriptions drop constraint if exists subscriptions_product_type_check;
alter table subscriptions add constraint subscriptions_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table products drop constraint if exists products_product_type_check;
alter table products add constraint products_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table product_configs drop constraint if exists product_configs_product_type_check;
alter table product_configs add constraint product_configs_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));

alter table feature_flags drop constraint if exists feature_flags_product_type_check;
alter table feature_flags add constraint feature_flags_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));
