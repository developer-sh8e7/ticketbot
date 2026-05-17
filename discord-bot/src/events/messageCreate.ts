import { Events, Message } from 'discord.js';
import { ExtendedClient } from '../types';

export default {
  name: Events.MessageCreate,
  async execute(message: Message, client: ExtendedClient) {
    if (message.author.bot) return;
  },
};