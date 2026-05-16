import fs from 'fs';

const file = 'src/services/ticketService.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /public async handleOpenSelect[\s\S]*?private async resolveTicketContext/m;

const replacement = `public async handleOpenSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'This action only works inside the guild.')]);
      return;
    }

    const categoryKey = interaction.values[0];
    const category = this.getEnabledCategory(categoryKey);

    if (!category) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'التصنيف المحدد غير موجود أو معطل.')]);
      return;
    }

    if (!category.questions || category.questions.length === 0) {
      await this.processTicketCreation(interaction, category, []);
      return;
    }

    try {
      const modal = buildOpenTicketModal(category);
      const shown = await safeShowModal(interaction, modal, \`open-select:\${category.key}\`);
      if (!shown) {
        return;
      }
    } catch (error) {
      logger.error('Failed to show ticket modal', error instanceof Error ? error.message : error);
      if (isInteractionLifecycleError(error)) {
        return;
      }

      await safeReply(interaction, [buildErrorEmbed(this.config, 'تعذر فتح نموذج التذكرة، يرجى المحاولة مرة أخرى.')]);
    }
  }

  public async handleOpenModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'This action only works inside the guild.')]);
      return;
    }

    const categoryKey = extractOpenTicketCategoryKey(interaction.customId);
    const category = categoryKey ? this.getEnabledCategory(categoryKey) : undefined;

    if (!category) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'تعذر تحديد بيانات هذه التذكرة.')]);
      return;
    }

    const answers = this.buildAnswers(interaction, category);
    await this.processTicketCreation(interaction, category, answers);
  }

  private async processTicketCreation(
    interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    category: TicketCategoryConfig,
    answers: TicketAnswer[]
  ): Promise<void> {
    if (!(await safeDeferReply(interaction, \`open-modal:\${category.key}\`))) {
      return;
    }

    const existing = await this.findExistingOpenTicket(interaction.guildId, interaction.user.id);
    if (existing?.channel_id) {
      const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
      if (!existingChannel) {
        await this.ticketRepository.closeByChannel(existing.channel_id, {
          closed_by: interaction.user.id,
          closed_by_tag: interaction.user.tag,
          close_reason: 'Auto-closed: channel no longer exists',
        }).catch(() => null);
        logger.info(\`Auto-closed stale ticket #\${existing.ticket_number} (channel deleted)\`);
      } else {
        await safeEditReply(interaction, [buildAlreadyOpenEmbed(this.config, existing.channel_id)]);
        return;
      }
    }

    let createdChannel: TextChannel | null = null;
    let createdTicket: TicketRecord | null = null;

    try {
      const ticketNumber = await this.ticketRepository.nextTicketNumber();
      const channelName = this.buildTicketChannelName(category, ticketNumber);
      const topic = this.buildTicketTopic(ticketNumber, interaction.user.tag, interaction.user.id, category);

      const created = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: this.config.guild.categoryId,
        topic,
        permissionOverwrites: this.buildPermissionOverwrites(interaction.guild, interaction.user.id, category),
      });

      if (!isGuildTextChannelType(created) || created.type !== ChannelType.GuildText) {
        throw new Error('Created channel is not a guild text channel.');
      }

      createdChannel = created;

      createdTicket = await this.ticketRepository.createTicket({
        ticket_number: ticketNumber,
        guild_id: interaction.guildId,
        channel_id: created.id,
        channel_name: created.name,
        creator_id: interaction.user.id,
        creator_tag: interaction.user.tag,
        category_key: category.key,
        category_label: category.label,
        participant_ids: [],
        answers,
        metadata: {
          panelChannelId: this.config.panel.channelId,
          questionCount: answers.length,
          openedByAvatarUrl: interaction.user.displayAvatarURL(),
        },
      });

      const welcomeEmbeds = await buildTicketEmbeds(interaction.guild, this.config, createdTicket);
      const mentionRoles = formatRoleMentions([
        ...this.config.guild.mentionRolesOnOpen,
        ...category.supportRoleIds,
      ]);

      const sentMessage = await created.send({
        content: \`\${interaction.user} \${mentionRoles}\`.trim(),
        embeds: welcomeEmbeds,
        components: buildTicketActionRows(this.config),
        allowedMentions: {
          users: [interaction.user.id],
          roles: uniqueStrings([
            ...this.config.guild.mentionRolesOnOpen,
            ...category.supportRoleIds,
          ]),
        },
      });

      if (this.config.limits.pinSummaryMessageOnCreate) {
        await sentMessage.pin().catch(() => null);
      }

      await this.sendLog(interaction.guild, this.buildOpenLogEmbed(createdTicket, created.id));

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إنشاء التذكرة', \`\${this.config.ticket.messages.created} <#\${created.id}>\`)]);
    } catch (error) {
      logger.error('Failed to open ticket', error instanceof Error ? error.message : error);

      if (createdTicket) {
        await this.ticketRepository.deleteTicketById(createdTicket.id).catch(() => null);
      }

      if (createdChannel) {
        await createdChannel.delete().catch(() => null);
      }

      if (error instanceof DuplicateOpenTicketError) {
        const duplicate = await this.ticketRepository.findOpenByCreator(interaction.guildId, interaction.user.id);
        const existingChannelId = duplicate?.channel_id || interaction.channelId || interaction.channel?.id;

        if (!existingChannelId) {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تم اكتشاف تذكرة مفتوحة لكن تعذر تحديد القناة الخاصة بها.')]);
          return;
        }

        await safeEditReply(interaction, [buildAlreadyOpenEmbed(this.config, existingChannelId)]);
        return;
      }

      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء إنشاء التذكرة.')]);
    }
  }

  private async resolveTicketContext`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated ticketService.ts');
