-- Achievements seed data
insert into public.achievements (code,name,name_ar,description,icon,requirement,reward_xp) values
('first_spin','First Spin','أول دورة','Spin the wheel for the first time','🎯','{"type":"total_spins","min":1}',100),
('spin_10','Ten Spins','عشر دورات','Spin the wheel 10 times','🎰','{"type":"total_spins","min":10}',250),
('spin_50','Fifty Spins','خمسين دورة','Spin the wheel 50 times','🎲','{"type":"total_spins","min":50}',500),
('spin_100','Century','مائة دورة','Spin the wheel 100 times','💯','{"type":"total_spins","min":100}',1000),
('common_collector','Common Collector','جامع العادي','Collect 10 common characters','⚪','{"type":"collect_rarity","rarity":"common","min":10}',150),
('uncommon_collector','Uncommon Collector','جامع غير الشائع','Collect 5 uncommon characters','🟢','{"type":"collect_rarity","rarity":"uncommon","min":5}',300),
('rare_collector','Rare Collector','جامع النادر','Collect 3 rare characters','🔵','{"type":"collect_rarity","rarity":"rare","min":3}',500),
('epic_collector','Epic Collector','جامع الملحمي','Collect 2 epic characters','🟣','{"type":"collect_rarity","rarity":"epic","min":2}',1000),
('legendary_collector','Legendary Collector','جامع الأسطوري','Collect 1 legendary character','🟡','{"type":"collect_rarity","rarity":"legendary","min":1}',2000),
('lucky_strike','Lucky Strike','ضربة الحظ','Win an epic or better character','⭐','{"type":"win_rarity","min_tier":4}',750),
('jackpot','Jackpot','الجاكبوت','Win a legendary character','🏆','{"type":"win_rarity","min_tier":5}',3000),
('streak_3','Three Day Streak','ثلاث أيام متتالية','Spin for 3 days in a row','🔥','{"type":"streak","min":3}',500),
('streak_7','Week Warrior','محارب الأسبوع','Spin for 7 days in a row','⚔️','{"type":"streak","min":7}',1500),
('streak_30','Monthly Master','سيد الشهر','Spin for 30 days in a row','👑','{"type":"streak","min":30}',5000)
on conflict (code) do nothing;
