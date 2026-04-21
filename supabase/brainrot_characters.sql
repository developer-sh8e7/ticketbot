-- Brainrot Characters (sample - add more as needed)
insert into public.brainrot_characters (name,name_ar,image_url,rarity,rarity_ar,tier,weight,is_real,description) values
('Brainrot God','إله البرينروت','https://i.imgur.com/brainrot1.jpg','common','عادي',1,500,true,'شائع'),
('Tung Sahur','تونغ ساهور','https://i.imgur.com/brainrot2.jpg','common','عادي',1,400,true,'صدى الليل'),
('Brr Patapim','بر باتابيم','https://i.imgur.com/brainrot3.jpg','common','عادي',1,350,true,'صوت غامض'),
('Bombardiro','قناص التمساح','https://i.imgur.com/brainrot4.jpg','common','عادي',1,300,true,'قناص محترف'),
('Glorb','غلورب','https://i.imgur.com/brainrot5.jpg','common','عادي',1,250,true,'وحش غامض'),
('Trippi Troppi','تريبي تروبي','https://i.imgur.com/brainrot6.jpg','uncommon','غير شائع',2,180,true,'سريع وذكي'),
('Drago Pazzo','التنين المجنون','https://i.imgur.com/brainrot7.jpg','uncommon','غير شائع',2,140,true,'نار ودمار'),
('Ninja Fortunato','النينجا المحظوظ','https://i.imgur.com/brainrot8.jpg','rare','نادر',3,80,true,'سريع ودقيق'),
('Squalo Elettrico','القرش الكهربائي','https://i.imgur.com/brainrot9.jpg','rare','نادر',3,60,true,'صدمات كهربائية'),
('Drago Gemma','التنين الجوهري','https://i.imgur.com/brainrot10.jpg','rare','نادر',3,40,true,'جوهرة نادرة'),
('Phoenix Oscuro','العنقاء المظلمة','https://i.imgur.com/brainrot11.jpg','epic','ملحمي',4,20,true,'نار سوداء'),
('Leviatano Digitale','اللوياثان الرقمي','https://i.imgur.com/brainrot12.jpg','epic','ملحمي',4,15,true,'عملاق البيانات'),
('Titan Nucleare','التيتان النووي','https://i.imgur.com/brainrot13.jpg','epic','ملحمي',4,10,true,'طاقة لا محدودة'),
('Brainrot Supreme','البرينروت الأعلى','https://i.imgur.com/brainrot14.jpg','legendary','أسطوري',5,3,true,'القمة المطلقة'),
('Arcangelo','ملاك البرينروت','https://i.imgur.com/brainrot15.jpg','legendary','أسطوري',5,2,true,'نور الإله'),
('Dio del Brainrot','إله البرينروت','https://i.imgur.com/brainrot16.jpg','legendary','أسطوري',5,1,true,'الأقوى في التاريخ'),
('Tung Ultra','تونغ الترا','https://i.imgur.com/secret1.jpg','secret','سري',6,0,false,'مستحيل الحصول عليه'),
('Gorbzilla','غوربزيلا','https://i.imgur.com/secret2.jpg','secret','سري',6,0,false,'الوحش المدمر'),
('Brainrot Infinity','البرينروت اللانهائي','https://i.imgur.com/secret3.jpg','secret','سري',6,0,false,'ما وراء الحدود')
on conflict (id) do nothing;
