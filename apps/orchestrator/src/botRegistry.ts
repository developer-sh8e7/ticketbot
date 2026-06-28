import type { BotFactory, ProductType } from '@opus/core';
import { createTicketBot } from '@opus/ticket-bot';
import { createVoiceRoomsBot } from '@opus/voice-rooms-bot';
import { createSystemBot } from '@opus/system-bot';

/**
 * سجل المصانع: يربط نوع المنتج بمصنع البوت المنفصل الخاص به.
 * هذا هو الجسر الذي يجعل الفصل مفيداً — الأوركستريتر لا يعرف تفاصيل أي بوت،
 * فقط يستدعي المصنع المناسب بنفس العقد الموحّد.
 */
export const BOT_FACTORIES: Record<ProductType, BotFactory> = {
  ticket: createTicketBot,
  voice_rooms: createVoiceRoomsBot,
  general: createSystemBot,
};

export function getBotFactory(productType: ProductType): BotFactory {
  const factory = BOT_FACTORIES[productType];
  if (!factory) throw new Error(`لا يوجد مصنع بوت للمنتج: ${productType}`);
  return factory;
}
