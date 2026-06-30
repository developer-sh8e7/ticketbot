# خريطة الترحيل — من المشروع القديم إلى OpusSolutions

تربط كل ملف في المشروع القديم (`Downloads/Ticket`) بوجهته الجديدة. الحالة:
- ✅ مُرحّل/أُعيد بناؤه في هذه الجلسة
- 🔁 يُنقل ويُعدّل (تبديل المسارات النسبية لاستيراد `@opus/core`)
- 🆕 جديد كلياً في النظام الجديد

> ملاحظة: نقل ملفات الكود الفعلي يحتاج بيئة الشيل (كانت معطّلة بسبب مساحة القرص). البنية والنواة والعقود والسكيمة والوثائق جاهزة، وهذه الخريطة تجعل بقية النقل آلياً ومباشراً.

## النواة المشتركة — `packages/core`

| القديم | الجديد | الحالة |
|--------|--------|--------|
| `src/env.ts` | `packages/core/src/env.ts` (قاعدة + `extend` لكل تطبيق) | ✅ |
| `src/utils/logger.ts` | `packages/core/src/logger.ts` (+ إخفاء توكنات البوتات) | ✅ |
| `src/utils/crypto.ts` | `packages/core/src/crypto.ts` (+ `encryptToken`) | ✅ |
| `src/database/supabase.ts` | `packages/core/src/supabase.ts` | ✅ |
| `src/database/types.ts` + `src/types/config.ts` | `packages/core/src/types.ts` (أنواع النطاق) | ✅ جزئياً |
| `src/utils/{discord,interaction,text,emoji,color,paths}.ts` | `packages/core/src/utils/*` | 🔁 |
| — (عقد تشغيل موحّد) | `packages/core/src/runtime.ts` | 🆕 |

## طبقة التحكم — `apps/orchestrator`

| القديم | الجديد | الحالة |
|--------|--------|--------|
| `src/services/botInstanceManager.ts` | `apps/orchestrator/src/manager.ts` (أُعيد بناؤه على العقد الموحّد) | ✅ مُعاد بناؤه |
| `src/database/botInstanceRepository.ts` | يُدمج في `manager.ts` + `tokenPool.ts` | 🔁 |
| `src/services/opusManagerService.ts` | `apps/orchestrator/src/subscriptions.ts` (إشعارات الانتهاء/التجديد + DM) | 🔁 |
| `src/database/opusRepository.ts` | `apps/orchestrator/src/subscriptionRepository.ts` | 🔁 |
| `src/services/linkUserService.ts` + `src/database/linkedUserRepository.ts` | `apps/orchestrator/src/accounts.ts` (جدول `accounts`) | 🔁 |
| `src/web/server.ts` + `src/web/security/middleware.ts` + `src/web/phone.ts` | `apps/orchestrator/src/index.ts` (Express webhook) + `web/*` | ✅ أساس + 🔁 |
| `src/services/verificationWebhookService.ts` | `apps/orchestrator/src/web/verification.ts` | 🔁 |
| `src/commands/{buildCommands,registerCommands,productCommandRegistry}.ts` | helpers مشتركة + تسجيل لكل بوت | 🔁 |
| — (بركة التوكنات الذرّية) | `apps/orchestrator/src/tokenPool.ts` + `db/schema/000_complete_schema.sql` | 🆕 |
| — (تفعيل + ربط إجباري) | `apps/orchestrator/src/provisioning.ts` | 🆕 |
| — (سجل المنتج→المصنع) | `apps/orchestrator/src/botRegistry.ts` | 🆕 |

## بوت التكتات — `apps/ticket-bot`

| القديم | الجديد | الحالة |
|--------|--------|--------|
| `src/services/ticketService.ts` | `apps/ticket-bot/src/services/ticketService.ts` | 🔁 |
| `src/services/panelService.ts` | `apps/ticket-bot/src/services/panelService.ts` | 🔁 |
| `src/services/transcriptService.ts` | `…/services/transcriptService.ts` | 🔁 |
| `src/services/escalationService.ts` | `…/services/escalationService.ts` | 🔁 |
| `src/services/complaintService.ts` | `…/services/complaintService.ts` | 🔁 |
| `src/services/mediatorService.ts` | `…/services/mediatorService.ts` | 🔁 |
| `src/handlers/mediatorApplicationHandler.ts` | `…/handlers/mediatorApplicationHandler.ts` | 🔁 |
| `src/services/vouchesService.ts` + `vouchesImageService.ts` | `…/services/vouches/*` | 🔁 |
| `src/services/welcomeService.ts` | `…/services/welcomeService.ts` | 🔁 |
| `src/services/aiService.ts` | `…/services/aiService.ts` (مدفوع فقط) | 🔁 |
| `src/services/securityService.ts` + `serverLogService.ts` | `…/services/*` | 🔁 |
| `src/services/roleManagementService.ts` + `roleProtectionService.ts` | `…/services/*` | 🔁 |
| `src/services/permissionService.ts` + `emojiService.ts` + `infrastructureService.ts` | `…/services/*` | 🔁 |
| `src/builders/{ticketBuilder,panelBuilder,modalBuilder}.ts` | `…/builders/*` | 🔁 |
| `src/database/{ticketRepository,mediatorRepository,complaintRepository,roleManagementRepository,roleProtectionRepository,infrastructureRepository}.ts` | `…/database/*` | 🔁 |
| `src/data/moderationWordLists.ts` | `…/data/moderationWordLists.ts` | 🔁 |
| `src/config/{schema,loadConfig}.ts` + `src/types/config.ts` + `src/services/configStore.ts` | `…/config/*` (نوع إعدادات التكتات) | 🔁 |
| `src/constants/customIds.ts` | `…/constants/customIds.ts` | 🔁 |
| `config/config_1413059459630104626.json` | `db/seed/config_1413059459630104626.json` → `server_configs` | ✅ |

## بوت الغرف المؤقتة — `apps/voice-rooms-bot`

| القديم | الجديد | الحالة |
|--------|--------|--------|
| `src/services/tempRoomService.ts` | `apps/voice-rooms-bot/src/services/tempRoomService.ts` | 🔁 |
| `src/services/voice247Service.ts` | `…/services/voice247Service.ts` | 🔁 |

## البوت العام — `apps/general-bot`

| القديم | الجديد | الحالة |
|--------|--------|--------|
| `discord-bot/` (40 أمر: economy, games, anti-nuke, mod, levels, settings) | `apps/general-bot/src/modules/*` | 🔁 |
| `SystemBot Opus/` (31 أمر — نسخة متباعدة) | يُدمج انتقائياً في `general-bot` (لا تفترض تطابقاً) | 🔁 |
| `BotGames/` (8 ألعاب) | `apps/general-bot/src/games/*` | 🔁 |
| `src/data/{gameKnowledgeBase,gameAdvancedMechanics,gameUnifiedIndex,index}.ts` | `…/data/*` | 🔁 |
| `src/wheel/api.ts` (عجلة الحظ) | `apps/general-bot/src/games/wheel/*` | 🔁 |

## خارج نطاق هذه الجلسة (للموقع/الإدارة لاحقاً)

| القديم | الوجهة المقترحة |
|--------|-----------------|
| `opus-ticket-website/` (Next.js) | يُعاد بناؤه كواجهة `apps/web` (تم اختيار الاستمرار على Next.js) |
| `dashboard.py` + `dashboard_assets/` | لوحة إدارة — تُدمج كـ admin داخل الموقع أو خدمة منفصلة |
| `developer-web/` | تطبيق بيانات الألعاب — يرتبط بالبوت العام |
