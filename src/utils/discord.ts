import {
  ActivityType,
  ButtonStyle,
  ChannelType,
  TextInputStyle,
  type GuildBasedChannel,
  type GuildTextBasedChannel,
} from 'discord.js';
import type { ActivityTypeName, ButtonStyleName, QuestionStyleName } from '../types/config.js';

export function activityTypeFromName(name: ActivityTypeName): ActivityType {
  switch (name) {
    case 'Playing':
      return ActivityType.Playing;
    case 'Streaming':
      return ActivityType.Streaming;
    case 'Listening':
      return ActivityType.Listening;
    case 'Watching':
      return ActivityType.Watching;
    case 'Competing':
      return ActivityType.Competing;
    default:
      return ActivityType.Watching;
  }
}

export function buttonStyleFromName(name: ButtonStyleName): ButtonStyle {
  switch (name) {
    case 'Primary':
      return ButtonStyle.Primary;
    case 'Success':
      return ButtonStyle.Success;
    case 'Danger':
      return ButtonStyle.Danger;
    case 'Secondary':
    default:
      return ButtonStyle.Secondary;
  }
}

export function textInputStyleFromName(name: QuestionStyleName): TextInputStyle {
  return name === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short;
}

export function isGuildTextChannel(channel: GuildBasedChannel | null): channel is GuildTextBasedChannel {
  if (!channel) {
    return false;
  }

  return channel.isTextBased() && !channel.isDMBased();
}

export function isGuildTextChannelType(channel: GuildBasedChannel | null): channel is GuildTextBasedChannel {
  if (!channel) {
    return false;
  }

  return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
}
