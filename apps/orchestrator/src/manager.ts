import {
  createLogger,
  decryptToken,
  type SupabaseClient,
  type BotInstanceRecord,
  type RunningBot,
} from '@opus/core';
import { getBotFactory } from './botRegistry.js';
import { TokenPoolRepository } from './tokenPool.js';

const log = createLogger('manager');
const SYNC_INTERVAL_MS = 60_000;

/**
 * مدير النسخ: يطابق الحالة المرغوبة (قاعدة البيانات) مع الواقع (البوتات المُشغّلة).
 *  - النسخ active بدون عميل مُشغّل → يشغّلها (يفك تشفير التوكن + يجلب الإعدادات).
 *  - النسخ المُشغّلة التي لم تعد active → يوقفها (الإعدادات تبقى محفوظة).
 *  - النسخ المنتهية → يعلّمها expired.
 */
export class InstanceManager {
  private readonly running = new Map<string, RunningBot>();
  private timer: ReturnType<typeof setInterval> | null = null;

  public constructor(
    private readonly supabase: SupabaseClient,
    private readonly tokenPool: TokenPoolRepository,
    private readonly encryptionKey: string,
  ) {}

  public async init(): Promise<void> {
    await this.sync();
    this.timer = setInterval(() => {
      this.sync().catch((e) => log.error('Sync failed', e instanceof Error ? e.message : e));
    }, SYNC_INTERVAL_MS);
    this.timer.unref?.();
    log.info(`Manager initialized — sync every ${SYNC_INTERVAL_MS / 1000}s`);
  }

  public async sync(): Promise<void> {
    await this.expireStale();
    const desired = await this.findActiveInstances();
    const desiredIds = new Set(desired.map((i) => i.id));

    for (const inst of desired) {
      if (!this.running.has(inst.id)) await this.startInstance(inst);
    }
    for (const id of [...this.running.keys()]) {
      if (!desiredIds.has(id)) await this.stopInstance(id, 'no longer active');
    }
  }

  private async findActiveInstances(): Promise<BotInstanceRecord[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('bot_instances')
      .select('*')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (error) throw new Error(`فشل جلب النسخ الفعّالة: ${error.message}`);
    return (data ?? []) as BotInstanceRecord[];
  }

  private async expireStale(): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.supabase
      .from('bot_instances')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);
  }

  /** يجلب الإعدادات المحفوظة لهذا (السيرفر × المنتج) — تجعل التجديد يرجع كأنه ما وقف. */
  private async loadConfig(inst: BotInstanceRecord): Promise<Record<string, unknown>> {
    const { data } = await this.supabase
      .from('server_configs')
      .select('config_data')
      .eq('guild_id', inst.guild_id)
      .eq('product_type', inst.product_type)
      .maybeSingle();
    return (data?.config_data as Record<string, unknown>) ?? {};
  }

  private async startInstance(inst: BotInstanceRecord): Promise<void> {
    const tokenRow = await this.tokenPool.findByInstance(inst.id);
    if (!tokenRow) {
      log.warn(`النسخة ${inst.id} بلا توكن محجوز — تخطّي`);
      return;
    }

    let token: string;
    try {
      token = decryptToken(tokenRow.bot_token_encrypted, this.encryptionKey);
    } catch (e) {
      log.error(`فشل فك تشفير توكن النسخة ${inst.id}`, e instanceof Error ? e.message : e);
      return;
    }

    const config = await this.loadConfig(inst);
    const factory = getBotFactory(inst.product_type);
    const bot = factory({
      token,
      guildId: inst.guild_id,
      ownerId: inst.owner_id,
      instanceId: inst.id,
      config,
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    });

    try {
      const { botUserId } = await bot.start();
      this.running.set(inst.id, bot);
      await this.supabase
        .from('bot_instances')
        .update({ bot_user_id: botUserId, last_started_at: new Date().toISOString() })
        .eq('id', inst.id);
      log.info(`🟢 شغّلت ${inst.product_type} (${inst.id}) للسيرفر ${inst.guild_id}`);
    } catch (e) {
      log.error(`فشل تشغيل النسخة ${inst.id}`, e instanceof Error ? e.message : e);
      await bot.stop().catch(() => null);
    }
  }

  private async stopInstance(id: string, reason: string): Promise<void> {
    const bot = this.running.get(id);
    if (!bot) return;
    log.info(`🔴 إيقاف ${id} (${reason})`);
    await bot.stop().catch(() => null);
    this.running.delete(id);
    await this.supabase
      .from('bot_instances')
      .update({ last_stopped_at: new Date().toISOString() })
      .eq('id', id)
      .catch?.(() => null);
  }

  public get runningCount(): number {
    return this.running.size;
  }

  public async destroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    for (const [, bot] of this.running) await bot.stop().catch(() => null);
    this.running.clear();
  }
}
