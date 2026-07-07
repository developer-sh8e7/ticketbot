import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { COLOR_GUILD_ID } from '../constants/colorTickets.js';
import { isSeedGuild } from '../constants/seedGuilds.js';

export interface BuildCommandOptions {
  includeOpusCommands?: boolean;
}

export function buildCommandDefinitions(config: AppConfig, options: BuildCommandOptions = {}) {
  const names = config.commands?.names ?? {} as Record<string, string>;
  const commands: SlashCommandBuilder[] = [];

  if (names.panelSend) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.panelSend)
        .setDescription('Send the ticket panel to the configured panel channel.') as SlashCommandBuilder,
    );
  }

  if (names.panelRefresh) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.panelRefresh)
        .setDescription('Refresh the configured ticket panel message or send a new one.')
        .addStringOption((option) =>
          option
            .setName('message-id')
            .setDescription('Specific panel message id to refresh.')
            .setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }

  if (names.configReload) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.configReload)
        .setDescription('Reload config.json without restarting the bot.') as SlashCommandBuilder,
    );
  }

  if (names.emojiRefresh) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.emojiRefresh)
        .setDescription('Delete and recreate all custom bot emojis with updated images.') as SlashCommandBuilder,
    );
  }

  if (names.ticketClose) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.ticketClose)
        .setDescription('Close the current ticket channel.')
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Reason for closing this ticket.')
            .setRequired(false),
        ) as unknown as SlashCommandBuilder,
    );
  }

  if (names.ticketStats) {
    commands.push(
      new SlashCommandBuilder()
        .setName(names.ticketStats)
        .setDescription('Show ticket statistics for this server.') as SlashCommandBuilder,
    );
  }

  commands.push(
    new SlashCommandBuilder()
      .setName('restore-panel')
      .setDescription('إعادة لوحة التحكم داخل التذكرة الحالية إذا اختفت.') as SlashCommandBuilder,
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Delete all messages sent by a specific user id across the server.')
      .addStringOption((option) =>
        option
          .setName('user-id')
          .setDescription('Copy ID of the user whose messages should be deleted.')
          .setRequired(true),
      ) as unknown as SlashCommandBuilder,
  );

  if (isSeedGuild(config.guild?.id)) {
    commands.push(
      new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Respawn all bot log channels and post what each log is for.') as SlashCommandBuilder,
    );
  }

  // AI Toggle command
  commands.push(
    new SlashCommandBuilder()
      .setName('ai')
      .setDescription('تشغيل أو إيقاف المساعد الآلي (AI) في السيرفر')
      .addSubcommand((sub) =>
        sub
          .setName('on')
          .setDescription('تفعيل المساعد الآلي للتذاكر بالكامل')
      )
      .addSubcommand((sub) =>
        sub
          .setName('off')
          .setDescription('إيقاف المساعد الآلي للتذاكر بالكامل')
      ) as unknown as SlashCommandBuilder
  );

  // Ticket Control Panel commands
  commands.push(
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('فتح لوحة التحكم الكاملة بالتذاكر (للأدمن فقط)') as SlashCommandBuilder
  );
  commands.push(
    new SlashCommandBuilder()
      .setName('panle')
      .setDescription('فتح لوحة التحكم الكاملة بالتذاكر (للأدمن فقط) - كتابة بديلة') as SlashCommandBuilder
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('24-7')
      .setDescription('إدخال البوت روم صوتي 24/7')
      .addChannelOption((option) =>
        option
          .setName('room')
          .setDescription('الروم الصوتي الذي يبقى فيه البوت')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true),
      ) as unknown as SlashCommandBuilder,
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('إخراج البوت من روم 24/7 وإيقاف التثبيت') as SlashCommandBuilder,
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('panel-mm')
      .setDescription('فتح لوحة التحكم الكاملة بالوسطاء (للإدارة فقط)') as SlashCommandBuilder
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('mm')
      .setDescription('لوحة إدارة صلاحيات إعطاء وإزالة الرتب للمالكين فقط') as SlashCommandBuilder
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('mediator-config')
      .setDescription('إدارة حالة التقديم على رتبة وسيط')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('open')
          .setDescription('فتح التقديم على رتبة وسيط'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('close')
          .setDescription('إغلاق التقديم على رتبة وسيط'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set-max')
          .setDescription('تحديد العدد الأقصى للوسطاء')
          .addIntegerOption((option) =>
            option
              .setName('number')
              .setDescription('العدد الأقصى')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true),
          ),
      ) as unknown as SlashCommandBuilder,
  );

  commands.push(
    new SlashCommandBuilder()
      .setName('panel-complaints-send')
      .setDescription('ارسال لوحة الشكاوي والاعتراضات لمركز الشكاوي (للأدمن فقط)') as SlashCommandBuilder
  );

  // Vouches / review command
  commands.push(
    new SlashCommandBuilder()
      .setName('vouches')
      .setDescription('إرسال تقييم للمنتج أو الخدمة')
      .addStringOption((option) =>
        option
          .setName('review')
          .setDescription('كلام العميل / التقييم (حد أقصى 120 حرف)')
          .setMinLength(2)
          .setMaxLength(120)
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName('rating')
          .setDescription('عدد النجوم (1-5)')
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false),
      ) as unknown as SlashCommandBuilder,
  );

  // Linked user info command (linking itself is done through the website OAuth flow)
  commands.push(
    new SlashCommandBuilder()
      .setName('info')
      .setDescription('عرض معلومات شخص مرتبط بالبوت (للمالك فقط)')
      .addStringOption((option) =>
        option
          .setName('user-id')
          .setDescription('كوبي آيدي الشخص')
          .setRequired(true),
      ) as unknown as SlashCommandBuilder,
  );

  // Color ("الوان البيوت") setup — provisions any missing configured color categories.
  // Registered ONLY for the one server that uses this feature.
  if (config.guild?.id === COLOR_GUILD_ID) {
    commands.push(
      new SlashCommandBuilder()
        .setName('setup-color')
        .setDescription('إنشاء كاتقوريات الألوان الناقصة (للأدمن فقط)')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    );
  }

  if (options.includeOpusCommands) {
    commands.push(
      new SlashCommandBuilder()
        .setName('trial')
        .setDescription('تسجيل تجربة مجانية في Supabase')
        .addStringOption((option) => option.setName('user_id').setDescription('آيدي الشخص / العميل').setRequired(true))
        .addStringOption((option) => option.setName('guild_id').setDescription('آيدي السيرفر').setRequired(true))
        .addStringOption((option) => option.setName('product_type').setDescription('نوع المنتج').setRequired(true)
          .addChoices(
            { name: 'ticket', value: 'ticket' },
            { name: 'system', value: 'system' },
            { name: 'verify', value: 'verify' },
            { name: 'custom', value: 'custom' },
            { name: 'web', value: 'web' },
          ))
        .addStringOption((option) => option.setName('guild_name').setDescription('اسم السيرفر إن توفر').setRequired(false))
        .addStringOption((option) => option.setName('bot_instance_id').setDescription('Bot instance ID إذا موجود').setRequired(false)) as unknown as SlashCommandBuilder,
    );

    commands.push(
      new SlashCommandBuilder()
        .setName('check')
        .setDescription('فحص تجربة أو اشتراك لشخص أو سيرفر')
        .addStringOption((option) => option.setName('id').setDescription('آيدي الشخص أو السيرفر').setRequired(true)) as unknown as SlashCommandBuilder,
    );

    commands.push(
      new SlashCommandBuilder()
        .setName('subscription')
        .setDescription('تسجيل اشتراك مدفوع في Supabase')
        .addStringOption((option) => option.setName('user_id').setDescription('آيدي العميل').setRequired(true))
        .addStringOption((option) => option.setName('guild_id').setDescription('آيدي السيرفر').setRequired(true))
        .addStringOption((option) => option.setName('product_type').setDescription('نوع المنتج').setRequired(true)
          .addChoices(
            { name: 'ticket', value: 'ticket' },
            { name: 'system', value: 'system' },
            { name: 'verify', value: 'verify' },
            { name: 'custom', value: 'custom' },
            { name: 'web', value: 'web' },
          ))
        .addIntegerOption((option) => option.setName('duration_days').setDescription('مدة الاشتراك بالأيام').setRequired(false))
        .addStringOption((option) => option.setName('guild_name').setDescription('اسم السيرفر إن توفر').setRequired(false))
        .addStringOption((option) => option.setName('bot_instance_id').setDescription('Bot instance ID إذا موجود').setRequired(false))
        .addStringOption((option) => option.setName('plan_name').setDescription('اسم الباقة').setRequired(false)) as unknown as SlashCommandBuilder,
    );
  }

  return commands;
}
