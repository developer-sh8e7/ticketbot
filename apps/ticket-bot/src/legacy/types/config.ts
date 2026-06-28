export type ButtonStyleName = 'Primary' | 'Secondary' | 'Success' | 'Danger';
export type QuestionStyleName = 'Short' | 'Paragraph';
export type PresenceStatusName = 'online' | 'idle' | 'dnd' | 'invisible';
export type ActivityTypeName = 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';

export interface BotPresenceConfig {
  status: PresenceStatusName;
  activityType: ActivityTypeName;
  activityName: string;
}

export interface BotVisualConfig {
  presence: BotPresenceConfig;
  locale: string;
  timezone: string;
  embedColor: string;
  errorColor: string;
  successColor: string;
  footerText: string;
  footerIconUrl: string;
}

export interface GuildConfig {
  id: string;
  categoryId: string;
  archiveCategoryId: string;
  logChannelId: string;
  transcriptChannelId: string;
  mediatorLogChannelId?: string;
  supportRoleIds: string[];
  managerRoleIds: string[];
  mentionRolesOnOpen: string[];
}

export interface ImageConfig {
  panelBannerUrl: string;
  ticketBannerUrl: string;
  thumbnailUrl: string;
}

export interface NamingConfig {
  ticketChannelPrefix: string;
  maxChannelNameLength: number;
  includeCategorySlug: boolean;
  zeroPadLength: number;
  topicTemplate: string;
}

export interface LimitConfig {
  allowOnlyOneOpenTicketPerUser: boolean;
  maxQuestionsPerCategory: number;
  maxAnswerLength: number;
  maxCategoryOptions: number;
  pinSummaryMessageOnCreate: boolean;
}

export interface PanelConfig {
  channelId: string;
  messageId: string;
  title: string;
  subtitle: string;
  description: string;
  menuPlaceholder: string;
  menuCustomId: string;
  defaultMention: string;
  showNumbers: boolean;
  accentText: string;
}

export interface TicketControlConfig {
  label: string;
  style: ButtonStyleName;
  emojiId: string;
}

export interface StatsControlConfig extends TicketControlConfig {
  allowedRoleIds: string[];
}

export interface TicketControlsConfig {
  close: TicketControlConfig;
  add: TicketControlConfig;
  remove: TicketControlConfig;
  claim: TicketControlConfig;
  pin: TicketControlConfig;
  stats: StatsControlConfig;
}

export interface TicketMessagesConfig {
  alreadyOpen: string;
  created: string;
  closed: string;
  claimed: string;
  unclaimed: string;
  addedMember: string;
  removedMember: string;
  noPermission: string;
  notInTicket: string;
}

export interface TicketConfig {
  welcomeTitle: string;
  welcomeDescription: string;
  summaryTitle: string;
  controls: TicketControlsConfig;
  messages: TicketMessagesConfig;
}

export interface EmojiConfig {
  panelIcon: string;
  ticketIcon: string;
  infoIcon: string;
  epicIcon: string;
  categories: Record<string, string>;
}

export interface TicketQuestionConfig {
  key: string;
  label: string;
  style: QuestionStyleName;
  placeholder: string;
  required: boolean;
  minLength: number;
  maxLength: number;
}

export interface TicketCategoryConfig {
  key: string;
  customId?: string;
  enabled: boolean;
  label: string;
  description: string;
  channelNameTemplate: string;
  supportRoleIds: string[];
  questions: TicketQuestionConfig[];
}

export interface CommandNamesConfig {
  panelSend: string;
  panelRefresh: string;
  configReload: string;
  emojiRefresh: string;
  ticketClose: string;
  ticketStats: string;
}

export interface CommandConfig {
  registerOnStartup: boolean;
  guildScoped: boolean;
  names: CommandNamesConfig;
}

export interface RoleProtectionConfig {
  enabled: boolean;
  protectedRoleId: string;
  protectedRoleName: string;
  excludedRoleId: string;
  syncIntervalMinutes: number;
}

export interface RoleManagementConfig {
  enabled: boolean;
  ownerId: string;
  allowedRoleIds: string[];
  blockedRoleIds: string[];
  dailyLimitedRoleId: string;
  dailyLimitedRoleLimit: number;
}

export interface MediatorWarningsConfig {
  enabled: boolean;
  mediatorRoleId: string;
  maxWarnings: number;
  removeRoleOnLimit: boolean;
}

export interface FeatureFlagsConfig {
  applicationsPanel: boolean;
  tempRoomsPanel: boolean;
}

export interface TempRoomState {
  ownerId: string;
  createdAt: number;
  allowedUserIds: string[];
  bannedUserIds: string[];
  userLimit: number;
  locked: boolean;
  hidden: boolean;
  systemManagedOverwrites: Record<string, string[]>;
}

export interface Voice247Config {
  enabled: boolean;
  channelId: string;
}

export interface TempRoomsConfig {
  enabled: boolean;
  categoryId: string;
  joinChannelId: string;
  controlChannelId: string;
  controlMessageId: string;
  defaultRoomName: string;
  defaultUserLimit: number;
  transferOwnershipOnOwnerLeave: boolean;
  deleteWhenEmpty: boolean;
  adminBypass: boolean;
  maxRooms: number;
  panelImageUrl: string;
  rooms: Record<string, TempRoomState>;
}

export interface AppConfig {
  bot: BotVisualConfig;
  guild: GuildConfig;
  images: ImageConfig;
  naming: NamingConfig;
  limits: LimitConfig;
  panel: PanelConfig;
  ticket: TicketConfig;
  emojis: EmojiConfig;
  categories: TicketCategoryConfig[];
  commands: CommandConfig;
  features: FeatureFlagsConfig;
  tempRooms: TempRoomsConfig;
  voice247: Voice247Config;
  roleProtection: RoleProtectionConfig;
  roleManagement: RoleManagementConfig;
  mediatorWarnings: MediatorWarningsConfig;
}

export interface TicketAnswer {
  key: string;
  label: string;
  value: string;
}
