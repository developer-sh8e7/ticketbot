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

const statsControlSchema = ticketControlSchema.extend({
  allowedRoleIds: z.array(z.string()),
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

const tempRoomStateSchema = z.object({
  ownerId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  allowedUserIds: z.array(z.string()).default([]),
  bannedUserIds: z.array(z.string()).default([]),
  userLimit: z.number().int().min(0).max(99).default(0),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  systemManagedOverwrites: z.record(z.array(z.string())).default({}),
});

const tempRoomsSchema = z.object({
  enabled: z.boolean().default(false),
  categoryId: z.string().default(''),
  joinChannelId: z.string().default(''),
  controlChannelId: z.string().default(''),
  controlMessageId: z.string().default(''),
  defaultRoomName: z.string().min(1).max(100).default('روم {username}'),
  defaultUserLimit: z.number().int().min(0).max(99).default(0),
  transferOwnershipOnOwnerLeave: z.boolean().default(true),
  deleteWhenEmpty: z.boolean().default(true),
  adminBypass: z.boolean().default(false),
  maxRooms: z.number().int().min(1).max(99).default(50),
  panelImageUrl: z.string().default('https://i.imgur.com/BiQetZY.png'),
  rooms: z.record(tempRoomStateSchema).default({}),
}).default({
  enabled: false,
  categoryId: '',
  joinChannelId: '',
  controlChannelId: '',
  controlMessageId: '',
  defaultRoomName: 'روم {username}',
  defaultUserLimit: 0,
  transferOwnershipOnOwnerLeave: true,
  deleteWhenEmpty: true,
  adminBypass: false,
  maxRooms: 50,
  panelImageUrl: 'https://i.imgur.com/BiQetZY.png',
  rooms: {},
});

const categorySchema = z.object({
  key: z.string().min(1),
  customId: z.string().min(1).optional(),
  enabled: z.boolean(),
  label: z.string().min(1),
  description: z.string().min(1).max(100),
  channelNameTemplate: z.string().min(1),
  supportRoleIds: z.array(z.string()),
  questions: z.array(questionSchema).min(0).max(5),
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
    footerText: z.string(),
    footerIconUrl: z.string(),
  }),
  guild: z.object({
    id: z.string().min(1),
    categoryId: z.string(),
    archiveCategoryId: z.string(),
    logChannelId: z.string(),
    transcriptChannelId: z.string(),
    mediatorLogChannelId: z.string().optional(),
    supportRoleIds: z.array(z.string()),
    managerRoleIds: z.array(z.string()),
    mentionRolesOnOpen: z.array(z.string()),
  }),
  images: z.object({
    panelBannerUrl: z.string(),
    ticketBannerUrl: z.string(),
    thumbnailUrl: z.string(),
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
    maxQuestionsPerCategory: z.number().int().min(0).max(5),
    maxAnswerLength: z.number().int().min(50).max(4000),
    maxCategoryOptions: z.number().int().min(1).max(25),
    pinSummaryMessageOnCreate: z.boolean(),
  }),
  panel: z.object({
    channelId: z.string(),
    messageId: z.string(),
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    menuPlaceholder: z.string().min(1).max(150),
    menuCustomId: z.string().min(1),
    defaultMention: z.string(),
    showNumbers: z.boolean(),
    accentText: z.string(),
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
      stats: statsControlSchema,
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
    infoIcon: z.string(),
    epicIcon: z.string(),
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
      emojiRefresh: z.string().min(1),
      ticketClose: z.string().min(1),
      ticketStats: z.string().min(1),
    }),
  }),
  features: z.object({
    applicationsPanel: z.boolean().default(false),
    tempRoomsPanel: z.boolean().default(true),
  }).default({ applicationsPanel: false, tempRoomsPanel: true }),
  tempRooms: tempRoomsSchema,
  voice247: z.object({
    enabled: z.boolean().default(false),
    channelId: z.string().default(''),
  }).default({ enabled: false, channelId: '' }),
  roleProtection: z.object({
    enabled: z.boolean(),
    protectedRoleId: z.string().min(1),
    protectedRoleName: z.string().min(1),
    excludedRoleId: z.string().min(1),
    syncIntervalMinutes: z.number().int().min(1).max(1440),
  }),
  roleManagement: z.object({
    enabled: z.boolean(),
    ownerId: z.string().min(1),
    allowedRoleIds: z.array(z.string().min(1)).min(1),
    blockedRoleIds: z.array(z.string().min(1)).default([]),
    dailyLimitedRoleId: z.string().min(1),
    dailyLimitedRoleLimit: z.number().int().min(1).max(100),
  }),
  mediatorWarnings: z.object({
    enabled: z.boolean().default(false),
    mediatorRoleId: z.string().default(''),
    maxWarnings: z.number().int().min(1).max(20).default(3),
    removeRoleOnLimit: z.boolean().default(true),
  }).default({
    enabled: false,
    mediatorRoleId: '',
    maxWarnings: 3,
    removeRoleOnLimit: true,
  }),
});

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
