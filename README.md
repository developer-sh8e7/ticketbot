# Advanced Ticket Bot — بوت تكتات احترافي

بوت تكتات متطور مبني بـ TypeScript + discord.js + Supabase، جاهز للنشر على Railway.

---

## المميزات

- تصنيفات تذاكر قابلة للتخصيص عبر `config/config.json`
- أسئلة مخصصة لكل تصنيف (Modal)
- أيقونات مخصصة من السيرفر عبر Emoji IDs
- حماية: تذكرة واحدة مفتوحة لكل عضو
- ترقيم تذاكر تصاعدي محفوظ في Supabase
- أزرار التذكرة: Close · Add · Remove · Claim · Pin
- **Claim يقفل التذكرة**: فقط صاحب التذكرة + الإداري المستلم يقدرون يكتبون
- تصدير Transcript بصيغة HTML عند الإغلاق
- إنشاء تلقائي للكاتقوريات والشانلات عند أول تشغيل (مع حفظها بالداتابيس عشان ما تتكرر)
- أوامر سلاش: إرسال اللوحة / تحديثها / إعادة تحميل الكونفق
- ثيم بنفسجي كامل

## التقنيات

- **TypeScript** — لغة البرمجة
- **discord.js v14** — مكتبة الديسكورد
- **Supabase** — قاعدة البيانات (PostgreSQL)
- **Railway** — الاستضافة
- **Zod** — التحقق من صحة الإعدادات

---

# الدليل الشامل — من الصفر إلى التشغيل

## الخطوة 1: إعداد Discord Bot

1. ادخل على [Discord Developer Portal](https://discord.com/developers/applications)
2. اضغط **New Application** → سمّ البوت → **Create**
3. من القائمة الجانبية اختر **Bot**
4. اضغط **Reset Token** → انسخ التوكن واحفظه (هذا هو `DISCORD_TOKEN`)
5. فعّل هالخيارات تحت **Privileged Gateway Intents**:
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
6. من القائمة الجانبية اختر **OAuth2**
7. انسخ **Client ID** (هذا هو `DISCORD_CLIENT_ID`)
8. اذهب إلى **OAuth2 → URL Generator**:
   - Scopes: `bot` + `applications.commands`
   - Bot Permissions: `Administrator`
9. انسخ الرابط المُولَّد وافتحه بالمتصفح → اختر سيرفرك → **Authorize**

## الخطوة 2: إعداد Supabase

1. ادخل على [Supabase](https://supabase.com) وسجّل دخول
2. اضغط **New Project** → اختر اسم ومنطقة → **Create**
3. انتظر لين يجهز المشروع
4. من القائمة الجانبية اختر **SQL Editor**
5. انسخ كل محتوى ملف `supabase/schema.sql` والصقه في المحرر
6. اضغط **Run** (أو Ctrl+Enter)
7. لازم يطلع لك ✅ **Success. No rows returned** — هذا يعني تم بنجاح

### الحصول على مفاتيح Supabase

1. من القائمة الجانبية اختر **Settings** → **API**
2. انسخ **Project URL** (هذا هو `SUPABASE_URL`)
3. تحت **Service Role Key** اضغط **Reveal** وانسخ المفتاح (هذا هو `SUPABASE_SERVICE_ROLE_KEY`)

> ⚠️ **تحذير**: مفتاح Service Role خطير، لا تشاركه مع أحد أبداً!

## الخطوة 3: رفع المشروع على GitHub

### تثبيت Git (إذا ما عندك)
- حمّل Git من [git-scm.com](https://git-scm.com/download/win) وثبّته

### إنشاء Repository جديد
1. ادخل على [GitHub](https://github.com) → **New Repository**
2. سمّه مثلاً `ticket-bot` → **Private** → **Create Repository**
3. **لا تختار** أي ملف (لا README ولا .gitignore)

### رفع الكود
افتح Terminal (PowerShell) داخل مجلد المشروع `Ticket` ونفّذ:

```powershell
git init
git add .
git commit -m "Initial commit - Ticket Bot"
git branch -M main
git remote add origin https://github.com/اسم_حسابك/ticket-bot.git
git push -u origin main
```

> غيّر `اسم_حسابك` باسم حسابك الحقيقي على GitHub.

## الخطوة 4: النشر على Railway

1. ادخل على [Railway](https://railway.com) وسجّل بحساب GitHub
2. اضغط **New Project** → **Deploy from GitHub repo**
3. اختر الريبو اللي رفعت فيه البوت (`ticket-bot`)
4. Railway بيبدأ يبني المشروع تلقائياً

### إضافة Environment Variables على Railway

1. اضغط على السيرفس (المربع اللي ظهر)
2. اختر تبويب **Variables**
3. أضف المتغيرات التالية واحد واحد:

| المتغير | القيمة |
|---------|--------|
| `DISCORD_TOKEN` | توكن البوت من Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Client ID من Discord Developer Portal |
| `SUPABASE_URL` | رابط مشروع Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح Service Role من Supabase |
| `CONFIG_PATH` | `./config/config.json` |

4. بعد إضافة كل المتغيرات، Railway بيعيد البناء تلقائياً
5. اضغط على **Deployments** وتأكد إنه يقول **Active** ✅

## الخطوة 5: استخدام البوت

### أول تشغيل
عند أول تشغيل، البوت بيسوي تلقائياً:
- ✅ كاتقوري **📩 التذاكر المفتوحة** (للتذاكر الجديدة)
- ✅ كاتقوري **📁 الأرشيف** (للتذاكر المغلقة)
- ✅ شانل **ticket-logs** (سجل العمليات)
- ✅ شانل **ticket-transcripts** (نسخ المحادثات)
- ✅ شانل **open-ticket** (لوحة فتح التذاكر)

> عند إعادة تشغيل البوت، ما يسوي الشانلات مرة ثانية — يتعرف عليها من الداتابيس.

### إرسال لوحة التذاكر
في أي شانل أو في شانل `open-ticket` اللي انسوى تلقائياً:
```
/ticket-panel-send
```

### تحديث اللوحة
```
/ticket-panel-refresh
```

### إعادة تحميل الإعدادات بدون إعادة تشغيل
```
/ticket-config-reload
```

## الخطوة 6: تخصيص الإعدادات

### ملف `config/config.json`

#### الألوان
```json
"embedColor": "#8b5cf6",
"errorColor": "#ef4444",
"successColor": "#22c55e"
```

#### أيقونات الإيموجي
لإضافة إيموجي مخصصة من سيرفرك:
1. اكتب الإيموجي في الديسكورد مع `\` قبلها، مثال: `\:ticket:`
2. بيطلع لك شي مثل `<:ticket:123456789>` — الرقم `123456789` هو الـ ID
3. حط الـ ID في الكونفق:
```json
"emojis": {
  "panelIcon": "123456789",
  "ticketIcon": "987654321",
  "categories": {
    "problems": "111111111",
    "inquiries": "222222222"
  }
}
```

#### أزرار التذكرة
```json
"controls": {
  "close": { "label": "Close", "style": "Secondary", "emojiId": "" },
  "claim": { "label": "Check", "style": "Secondary", "emojiId": "" }
}
```
- **style**: `Primary` (أزرق) · `Secondary` (رمادي) · `Success` (أخضر) · `Danger` (أحمر)

#### أسئلة التذكرة
```json
"questions": [
  {
    "key": "customer",
    "label": "Are you a customer?",
    "style": "Short",
    "placeholder": "نعم / لا",
    "required": true,
    "minLength": 1,
    "maxLength": 100
  }
]
```
- **style**: `Short` (سطر واحد) أو `Paragraph` (عدة أسطر)
- أقصى عدد أسئلة لكل تصنيف: **5**

---

## هيكل المشروع

```
Ticket/
├── config/
│   └── config.json          # إعدادات البوت الرئيسية
├── supabase/
│   └── schema.sql           # جداول قاعدة البيانات
├── src/
│   ├── index.ts             # نقطة البداية
│   ├── env.ts               # تحميل متغيرات البيئة
│   ├── types/
│   │   └── config.ts        # أنواع TypeScript
│   ├── config/
│   │   ├── schema.ts        # تحقق Zod
│   │   └── loadConfig.ts    # تحميل الكونفق
│   ├── constants/
│   │   └── customIds.ts     # معرّفات الأزرار
│   ├── database/
│   │   ├── supabase.ts      # اتصال Supabase
│   │   ├── types.ts         # أنواع الجداول
│   │   ├── ticketRepository.ts
│   │   └── infrastructureRepository.ts
│   ├── builders/
│   │   ├── panelBuilder.ts  # بناء لوحة التذاكر
│   │   ├── ticketBuilder.ts # بناء رسائل التذكرة
│   │   └── modalBuilder.ts  # بناء النماذج
│   ├── services/
│   │   ├── configStore.ts   # إدارة الإعدادات
│   │   ├── infrastructureService.ts  # إنشاء تلقائي
│   │   ├── panelService.ts  # إدارة اللوحة
│   │   ├── permissionService.ts      # الصلاحيات
│   │   ├── ticketService.ts # منطق التذاكر
│   │   └── transcriptService.ts      # تصدير المحادثات
│   ├── commands/
│   │   ├── buildCommands.ts
│   │   └── registerCommands.ts
│   └── utils/
│       ├── color.ts
│       ├── discord.ts
│       ├── emoji.ts
│       ├── logger.ts
│       ├── paths.ts
│       └── text.ts
├── .env                     # متغيرات البيئة (لا ترفعه)
├── .env.example             # مثال لمتغيرات البيئة
├── .gitignore
├── package.json
├── tsconfig.json
├── railway.json
└── README.md
```

---

## التشغيل محلياً (اختياري)

```powershell
npm install
npm run build
npm start
```

أو للتطوير:
```powershell
npm run dev
```

## الرولات المُعدّة

| الرول | الآيدي | النوع |
|-------|--------|-------|
| Owner | `1483038264393990164` | Manager + Support |
| Co Owner | `1483020976966074479` | Manager + Support |
| فاوندر | `1483021277181644842` | Manager + Support |
| Super Admin | `1483212264025886886` | Manager + Support |
| مسؤول عن جميع الادارة | `1483021186559639674` | Manager + Support |
| Admin | `1483021366792949760` | Support |
| وسيط مضمون | `1483021658003345408` | Support |

- **Manager**: يقدر يرسل اللوحة + يحذف + يدير التذاكر + يسوي Claim
- **Support**: يقدر يدير التذاكر + يسوي Claim

---

## ملاحظات مهمة

- ألوان الأزرار في Discord محدودة من المنصة نفسها (أزرق / رمادي / أخضر / أحمر فقط)
- البوت يستخدم `Secondary` (رمادي) لجميع الأزرار بشكل موحد
- لتغيير صور البانر، ارفع صورك على أي استضافة صور وحط الروابط في `config/config.json`
- **غيّر التوكن فوراً** إذا انكشف لأي شخص — من Discord Developer Portal → Bot → Reset Token

---

## حل المشاكل الشائعة

| المشكلة | الحل |
|---------|------|
| البوت ما يشتغل | تأكد من Environment Variables على Railway |
| الأوامر ما تظهر | انتظر دقيقة أو استخدم `/ticket-config-reload` |
| خطأ في Supabase | تأكد إنك شغلت `schema.sql` كامل في SQL Editor |
| الشانلات ما انسوت | تأكد إن البوت عنده صلاحية Administrator |
| Claim ما يشتغل | تأكد إن رولك موجود في `supportRoleIds` أو `managerRoleIds` |
# TicketBot
# TicketBot
# TicketBot
