import fs from 'node:fs';
import path from 'node:path';
import { appConfigSchema } from './schema.js';
import type { AppConfig } from '../types/config.js';

function normalizeHex(value: string): string {
  return value.startsWith('#') ? value : `#${value}`;
}

function validateBusinessRules(config: AppConfig): void {
  const enabledCategories = config.categories.filter((category) => category.enabled);

  if (enabledCategories.length === 0) {
    throw new Error('config.json must contain at least one enabled category.');
  }

  if (enabledCategories.length > config.limits.maxCategoryOptions) {
    throw new Error('Enabled categories exceed limits.maxCategoryOptions.');
  }

  const seenKeys = new Set<string>();
  for (const category of config.categories) {
    if (seenKeys.has(category.key)) {
      throw new Error(`Duplicate category key found: ${category.key}`);
    }

    seenKeys.add(category.key);

    if (category.questions.length > config.limits.maxQuestionsPerCategory) {
      throw new Error(`Category ${category.key} exceeds limits.maxQuestionsPerCategory.`);
    }

    const questionKeys = new Set<string>();
    for (const question of category.questions) {
      if (question.minLength > question.maxLength) {
        throw new Error(`Question ${question.key} in category ${category.key} has invalid min/max length.`);
      }

      if (question.maxLength > config.limits.maxAnswerLength) {
        throw new Error(`Question ${question.key} in category ${category.key} exceeds limits.maxAnswerLength.`);
      }

      if (questionKeys.has(question.key)) {
        throw new Error(`Duplicate question key ${question.key} in category ${category.key}.`);
      }

      questionKeys.add(question.key);
    }
  }
}

export function loadConfig(configPath: string): AppConfig {
  const resolvedPath = path.resolve(configPath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const config = appConfigSchema.parse(parsed) as AppConfig;

  config.bot.embedColor = normalizeHex(config.bot.embedColor);
  config.bot.errorColor = normalizeHex(config.bot.errorColor);
  config.bot.successColor = normalizeHex(config.bot.successColor);

  validateBusinessRules(config);
  return config;
}
