import { z } from 'zod';

const buttonStyleSchema = z.enum(['Primary', 'Secondary', 'Success', 'Danger']);
const questionStyleSchema = z.enum(['Short', 'Paragraph']);
const presenceStatusSchema = z.enum(['online', 'idle', 'dnd', 'invisible']);
const activityTypeSchema = z.enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Competing']);

const ticketControlSchema = z.object({
  label: z.string().min(1),
  style: buttonStyleSchema,
  emojiId: z.string(),
});

const questionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  style: questionStyleSchema,
  placeholder: z.string().max(100).default(''),
  required: z.boolean(),
  minLength: z.number().int().min(0).max(4000),
  maxLength: z.number().int().min(1).max(4000),
});

const categorySchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  label: z.string().min(1),
  description: z.string().min(1).max(100),
  channelNameTemplate: z.string().min(1),
  supportRoleIds: z.array(z.string()),
  questions: z.array(questionSchema).min(1).max(5),
});

export const appConfigSchema = z.object({
  bot: z.object({
    presence: z.object({
      status: presenceStatusSchema,
      activityType: activityTypeSchema,
      activityName: z.string().min(1),
    }),
    locale: z.string().min(2),
    timezone: z.string().min(2),
    embedColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
    errorColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
    successColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
    footerText: z.string().min(1),
    footerIconUrl: z.string(),
  }),
  guild: z.object({
    id: z.string().min(1),
    categoryId: z.string(),
    archiveCategoryId: z.string(),
    logChannelId: z.string(),
    transcriptChannelId: z.string(),
    supportRoleIds: z.array(z.string()),
    managerRoleIds: z.array(z.string()),
    mentionRolesOnOpen: z.array(z.string()),
  }),
  images: z.object({
    panelBannerUrl: z.string().url(),
    ticketBannerUrl: z.string().url(),
    thumbnailUrl: z.string().url(),
  }),
  naming: z.object({
    ticketChannelPrefix: z.string().min(1),
    maxChannelNameLength: z.number().int().min(10).max(100),
    includeCategorySlug: z.boolean(),
    zeroPadLength: z.number().int().min(1).max(12),
    topicTemplate: z.string().min(1),
  }),
  limits: z.object({
    allowOnlyOneOpenTicketPerUser: z.boolean(),
    maxQuestionsPerCategory: z.number().int().min(1).max(5),
    maxAnswerLength: z.number().int().min(50).max(4000),
    maxCategoryOptions: z.number().int().min(1).max(25),
    pinSummaryMessageOnCreate: z.boolean(),
  }),
  panel: z.object({
    channelId: z.string(),
    messageId: z.string(),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    description: z.string().min(1),
    menuPlaceholder: z.string().min(1).max(150),
    menuCustomId: z.string().min(1),
    defaultMention: z.string(),
    showNumbers: z.boolean(),
    accentText: z.string().min(1),
  }),
  ticket: z.object({
    welcomeTitle: z.string().min(1),
    welcomeDescription: z.string().min(1),
    summaryTitle: z.string().min(1),
    controls: z.object({
      close: ticketControlSchema,
      add: ticketControlSchema,
      remove: ticketControlSchema,
      claim: ticketControlSchema,
      pin: ticketControlSchema,
    }),
    messages: z.object({
      alreadyOpen: z.string().min(1),
      created: z.string().min(1),
      closed: z.string().min(1),
      claimed: z.string().min(1),
      unclaimed: z.string().min(1),
      addedMember: z.string().min(1),
      removedMember: z.string().min(1),
      noPermission: z.string().min(1),
      notInTicket: z.string().min(1),
    }),
  }),
  emojis: z.object({
    panelIcon: z.string(),
    ticketIcon: z.string(),
    categories: z.record(z.string()),
  }),
  categories: z.array(categorySchema).min(1).max(25),
  commands: z.object({
    registerOnStartup: z.boolean(),
    guildScoped: z.boolean(),
    names: z.object({
      panelSend: z.string().min(1),
      panelRefresh: z.string().min(1),
      configReload: z.string().min(1),
    }),
  }),
});

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
