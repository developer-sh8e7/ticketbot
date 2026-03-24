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

export interface TicketControlsConfig {
  close: TicketControlConfig;
  add: TicketControlConfig;
  remove: TicketControlConfig;
  claim: TicketControlConfig;
  pin: TicketControlConfig;
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
}

export interface CommandConfig {
  registerOnStartup: boolean;
  guildScoped: boolean;
  names: CommandNamesConfig;
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
}

export interface TicketAnswer {
  key: string;
  label: string;
  value: string;
}
