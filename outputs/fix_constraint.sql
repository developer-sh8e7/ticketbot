alter table bot_instances drop constraint if exists bot_instances_product_type_check;
alter table bot_instances add constraint bot_instances_product_type_check
  check (product_type in ('ticket','voice_rooms','general'));
