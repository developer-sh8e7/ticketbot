-- One-shot SQL for guild 1413059459630104626: system legacy tables + server configs.

-- Run once in Supabase SQL editor to satisfy the legacy SystemBot XP/economy/settings tables.
-- Fixes: Could not find the table 'public.members' in the schema cache.

alter table guilds add column if not exists prefix text not null default '!';
alter table guilds add column if not exists language text not null default 'en';
alter table guilds add column if not exists embed_color text not null default '5865F2';
alter table guilds add column if not exists owner_id text;

create table if not exists guild_channels (
  guild_id                text primary key,
  welcome_channel         text,
  leave_channel           text,
  logs_channel            text,
  message_logs_channel    text,
  voice_logs_channel      text,
  join_leave_logs_channel text,
  updated_at              timestamptz not null default now()
);

create table if not exists guild_roles (
  guild_id   text primary key,
  auto_role  text,
  mute_role  text,
  mod_role   text,
  admin_role text,
  updated_at timestamptz not null default now()
);

create table if not exists guild_modules (
  guild_id          text primary key,
  welcome_enabled   boolean not null default true,
  leave_enabled     boolean not null default true,
  logging_enabled   boolean not null default true,
  antiraid_enabled  boolean not null default false,
  automod_enabled   boolean not null default false,
  antilinks_enabled boolean not null default false,
  antispam_enabled  boolean not null default false,
  antibots_enabled  boolean not null default false,
  antiswear_enabled boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table if not exists users (
  id         text primary key,
  username   text,
  credits    integer not null default 0,
  global_xp  integer not null default 0,
  last_daily timestamptz,
  rep        integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  guild_id   text not null,
  user_id    text not null references users(id) on delete cascade,
  xp         integer not null default 0,
  level      integer not null default 1,
  warnings   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists idx_members_guild_xp on members(guild_id, xp desc);
create index if not exists idx_members_user on members(user_id);

-- Force PostgREST/Supabase to refresh its schema cache after creating members/users.
notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════
-- Seed: إعدادات السيرفر الخاص 1413059459630104626
-- هذا السيرفر زبون عادي داخل نظام الأوتو، لكن له إعدادات تكتات/TempRooms خاصة.
-- المصدر: db/seed/config_1413059459630104626.json
-- شغّله من Supabase SQL editor بعد db/schema/000_complete_schema.sql.
-- ════════════════════════════════════════════════════════════════

insert into guilds (id, name, prefix)
values ('1413059459630104626', 'STB الــعــرب', '!')
on conflict (id) do update
  set name = coalesce(excluded.name, guilds.name), prefix = excluded.prefix, updated_at = now();

insert into guild_channels (guild_id) values ('1413059459630104626') on conflict (guild_id) do nothing;
insert into guild_roles (guild_id) values ('1413059459630104626') on conflict (guild_id) do nothing;
insert into guild_modules (guild_id) values ('1413059459630104626') on conflict (guild_id) do nothing;

with cfg as (
  select $config${
  "bot": {
    "presence": {
      "status": "online",
      "activityType": "Playing",
      "activityName": "STB الــعــرب"
    },
    "locale": "ar",
    "timezone": "Asia/Riyadh",
    "embedColor": "#8b5cf6",
    "errorColor": "#ef4444",
    "successColor": "#22c55e",
    "footerText": "Ticket Support System",
    "footerIconUrl": ""
  },
  "guild": {
    "id": "1413059459630104626",
    "categoryId": "",
    "archiveCategoryId": "",
    "logChannelId": "",
    "transcriptChannelId": "",
    "supportRoleIds": [
      "1483021658003345408",
      "1483209015961063595",
      "1483021366792949760",
      "1483212264025886886",
      "1483021277181644842",
      "1483020976966074479",
      "1483038264393990164",
      "1506010346777874472",
      "1506010306407694346",
      "1506009944053387264",
      "1505709899345170643"
    ],
    "managerRoleIds": [
      "1483021658003345408",
      "1483209015961063595",
      "1483021366792949760",
      "1483212264025886886",
      "1483021277181644842",
      "1483020976966074479",
      "1483038264393990164",
      "1506010346777874472",
      "1506010306407694346",
      "1506009944053387264",
      "1505709899345170643"
    ],
    "mentionRolesOnOpen": [
      "1483021658003345408",
      "1483021366792949760"
    ]
  },
  "images": {
    "panelBannerUrl": "https://i.imgur.com/ajJ2iut.png",
    "ticketBannerUrl": "https://i.imgur.com/61VOe9U.png",
    "thumbnailUrl": "https://placehold.co/256x256/1a0533/8b5cf6?text=T"
  },
  "naming": {
    "ticketChannelPrefix": "ticket",
    "maxChannelNameLength": 90,
    "includeCategorySlug": false,
    "zeroPadLength": 4,
    "topicTemplate": "Ticket #{ticketNumber} | User: {userTag} ({userId}) | Category: {categoryLabel}"
  },
  "limits": {
    "allowOnlyOneOpenTicketPerUser": true,
    "maxQuestionsPerCategory": 5,
    "maxAnswerLength": 400,
    "maxCategoryOptions": 25,
    "pinSummaryMessageOnCreate": false
  },
  "panel": {
    "channelId": "",
    "messageId": "",
    "title": "عجلة الحظ | Steal the Brainrot",
    "subtitle": "مرحباً بكم",
    "description": "يرجى اختيار نوع طلبك من القائمة أدناه، ثم أجب على الأسئلة المطلوبة وسيتم إنشاء التذكرة تلقائياً.",
    "menuPlaceholder": "اضغط هنا لفتح تذكرة",
    "menuCustomId": "ticket:open-select",
    "defaultMention": "@everyone",
    "showNumbers": true,
    "accentText": "يا هلا؟"
  },
  "ticket": {
    "welcomeTitle": "تم فتح تذكرتك",
    "welcomeDescription": "أهلاً بك، يرجى التحلي بالصبر حتى يتمكن أحد أعضاء الفريق من معالجة طلبك.",
    "summaryTitle": "معلومات التذكرة",
    "controls": {
      "close": {
        "label": "إغلاق",
        "style": "Secondary",
        "emojiId": ""
      },
      "add": {
        "label": "إضأفة شخص",
        "style": "Secondary",
        "emojiId": ""
      },
      "remove": {
        "label": "إزالة شخص",
        "style": "Secondary",
        "emojiId": ""
      },
      "claim": {
        "label": "استلام",
        "style": "Secondary",
        "emojiId": ""
      },
      "pin": {
        "label": "تثبيت",
        "style": "Secondary",
        "emojiId": ""
      },
      "stats": {
        "label": "إحصائيات",
        "style": "Secondary",
        "emojiId": "",
        "allowedRoleIds": [
          "1483021658003345408",
          "1483209015961063595",
          "1483021366792949760",
          "1483038264393990164",
          "1483020976966074479",
          "1483212264025886886",
          "1506010346777874472",
          "1506010306407694346",
          "1506009944053387264",
          "1505709899345170643"
        ]
      }
    },
    "messages": {
      "alreadyOpen": "لديك بالفعل تذكرة مفتوحة، وهي:",
      "created": "تم إنشاء تذكرتك بنجاح.",
      "closed": "تم إغلاق التذكرة.",
      "claimed": "تم استلام التذكرة بواسطة",
      "unclaimed": "تم إلغاء استلام التذكرة.",
      "addedMember": "تمت إضافة العضو إلى التذكرة.",
      "removedMember": "تمت إزالة العضو من التذكرة.",
      "noPermission": "ليس لديك الصلاحية لاستخدام هذا الزر.",
      "notInTicket": "هذا الزر يعمل داخل قنوات التذاكر فقط."
    }
  },
  "emojis": {
    "panelIcon": "",
    "ticketIcon": "",
    "infoIcon": "",
    "epicIcon": "",
    "categories": {
      "middleman": "",
      "house_unlock": "",
      "purchase": "",
      "house_unlock_jump": "1523691612771979446"
    }
  },
  "categories": [
    {
      "key": "middleman",
      "enabled": true,
      "label": "وســيــط مضمون",
      "description": "لضمان عملية التداول بوجود وسيط، افتح تذكرة هنا.",
      "channelNameTemplate": "وســيــط・مضمون・{ticketNumber}",
      "supportRoleIds": [
        "1506010306407694346"
      ],
      "questions": [
        {
          "key": "epic_id",
          "label": "ايديك EPIC",
          "style": "Short",
          "placeholder": "اكتب ايدي الـ EPIC الخاص بك",
          "required": true,
          "minLength": 3,
          "maxLength": 100
        }
      ]
    },
    {
      "key": "house_unlock",
      "enabled": true,
      "label": "اللوان البيوت",
      "description": "لطلب خدمة اللوان البيوت، افتح تذكرة هنا.",
      "channelNameTemplate": "لون-{houseColor}-{ticketNumber}",
      "supportRoleIds": [
        "1483209015961063595"
      ],
      "questions": [
        {
          "key": "epic_id",
          "label": "ايديك EPIC",
          "style": "Short",
          "placeholder": "اكتب ايدي الـ EPIC الخاص بك",
          "required": true,
          "minLength": 3,
          "maxLength": 100
        },
        {
          "key": "house_color",
          "label": "لون البيت الي تبي تفتحه",
          "style": "Short",
          "placeholder": "مثال: دريمي",
          "required": true,
          "minLength": 2,
          "maxLength": 50
        }
      ]
    },
    {
      "key": "house_unlock_jump",
      "enabled": true,
      "label": "اللوان البيوت (ماب النطة)",
      "description": "لطلب خدمة اللوان البيوت (ماب النطة)، افتح تذكرة هنا.",
      "channelNameTemplate": "لون-{houseColor}-{ticketNumber}",
      "supportRoleIds": [
        "1483209015961063595"
      ],
      "questions": [
        {
          "key": "epic_id",
          "label": "ايديك EPIC",
          "style": "Short",
          "placeholder": "اكتب ايدي الـ EPIC الخاص بك",
          "required": true,
          "minLength": 3,
          "maxLength": 100
        },
        {
          "key": "house_color",
          "label": "لون البيت الي تبي تفتحه",
          "style": "Short",
          "placeholder": "مثال: سايبر",
          "required": true,
          "minLength": 2,
          "maxLength": 50
        }
      ]
    },
    {
      "key": "purchase",
      "enabled": true,
      "label": "عـمـلـيـة شـرأء",
      "description": "لإتمام عملية الشراء، افتح تذكرة هنا.",
      "channelNameTemplate": "عملية-شرأء-{ticketNumber}",
      "supportRoleIds": [],
      "questions": [
        {
          "key": "epic_id",
          "label": "ايديك EPIC",
          "style": "Short",
          "placeholder": "اكتب ايدي الـ EPIC الخاص بك",
          "required": true,
          "minLength": 3,
          "maxLength": 100
        },
        {
          "key": "purchase_type",
          "label": "وش عملية الشراء؟",
          "style": "Paragraph",
          "placeholder": "اشرح ماذا تريد شراء بالتفصيل",
          "required": true,
          "minLength": 5,
          "maxLength": 400
        }
      ]
    }
  ],
  "commands": {
    "registerOnStartup": true,
    "guildScoped": true,
    "names": {
      "panelSend": "ticket-panel-send",
      "panelRefresh": "ticket-panel-refresh",
      "configReload": "ticket-config-reload",
      "emojiRefresh": "ticket-emoji-refresh",
      "ticketClose": "ticket-close",
      "ticketStats": "ticket-stats"
    }
  },
  "roleProtection": {
    "enabled": true,
    "protectedRoleId": "1483237139637469417",
    "protectedRoleName": "STB | Member",
    "excludedRoleId": "1483022301908832388",
    "syncIntervalMinutes": 10
  },
  "roleManagement": {
    "enabled": true,
    "ownerId": "1397364822152315052",
    "allowedRoleIds": [
      "1483022301908832388",
      "1484730388898123806",
      "1483208475227193555",
      "1483212750074417212",
      "1483208671126356118",
      "1486862867767492890",
      "1506083939679469769",
      "1496651113003352188",
      "1505310496004378766",
      "1506346113580667111",
      "1504574828579913798",
      "1498410561287753848",
      "1505377527257104495",
      "1504574981953294437",
      "1484749681371385927"
    ],
    "blockedRoleIds": [
      "1506010306407694346",
      "1483209015961063595"
    ],
    "dailyLimitedRoleId": "1483022301908832388",
    "dailyLimitedRoleLimit": 5
  },
  "mediatorWarnings": {
    "enabled": true,
    "mediatorRoleId": "1506010306407694346",
    "maxWarnings": 3,
    "removeRoleOnLimit": true
  },
  "features": {
    "applicationsPanel": true,
    "tempRoomsPanel": true
  },
  "tempRooms": {
    "enabled": false,
    "categoryId": "",
    "joinChannelId": "",
    "controlChannelId": "",
    "controlMessageId": "",
    "defaultRoomName": "{username}",
    "defaultUserLimit": 99,
    "transferOwnershipOnOwnerLeave": true,
    "deleteWhenEmpty": true,
    "adminBypass": true,
    "maxRooms": 50,
    "panelImageUrl": "https://i.imgur.com/BiQetZY.png",
    "rooms": {}
  },
  "voice247": {
    "enabled": false,
    "channelId": ""
  },
  "jail": {
    "enabled": true,
    "allowedRoleIds": [],
    "allowedUserIds": [
      "1397364822152315052"
    ],
    "controlChannelId": "",
    "jailRoleId": "",
    "updatedAt": null
  }
}$config$::jsonb as data
), products(product_type) as (
  values ('ticket'), ('voice_rooms'), ('general')
)
insert into server_configs (guild_id, product_type, config_data)
select '1413059459630104626', products.product_type, cfg.data
from cfg cross join products
on conflict (guild_id, product_type) do update
  set config_data = excluded.config_data,
      updated_at = now();

-- الأوامر الخاصة المأخوذة من config_1413059459630104626-Old.json:
-- ticket-panel-send, ticket-panel-refresh, ticket-config-reload,
-- ticket-emoji-refresh, ticket-close, ticket-stats.
-- /setup-room صار يسجل من بوت voice_rooms بقيم تلقائية:
-- category=الرومات المؤقتة, trigger=➕・إنشاء روم, room-template={username},
-- control-name=لوحة-تحكم, user-limit=99, admin-bypass=true.
