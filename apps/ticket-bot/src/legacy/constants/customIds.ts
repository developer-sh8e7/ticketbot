export const OPEN_TICKET_MODAL_PREFIX = 'ticket:modal:open:';
export const ADD_MEMBER_MODAL_ID = 'ticket:modal:add-member';
export const REMOVE_MEMBER_MODAL_ID = 'ticket:modal:remove-member';
export const APPLY_MEDIATOR = 'apply_mediator_role';
export const MEDIATOR_ACCEPT_PREFIX = 'mediator:accept:';
export const MEDIATOR_REJECT_PREFIX = 'mediator:reject:';
export const MEDIATOR_CLOSE_PREFIX = 'mediator:close:';
export const MEDIATOR_CLOSE_CONFIRM_PREFIX = 'mediator:close-confirm:';
export const MEDIATOR_CLOSE_CANCEL_PREFIX = 'mediator:close-cancel:';
export const MEDIATOR_ACCEPT_MODAL_PREFIX = 'mediator:accept-modal:';
export const MEDIATOR_REJECT_MODAL_PREFIX = 'mediator:reject-modal:';

export const TICKET_BUTTON_IDS = {
  close: 'ticket:btn:close',
  add: 'ticket:btn:add',
  remove: 'ticket:btn:remove',
  claim: 'ticket:btn:claim',
  pin: 'ticket:btn:pin',
  stats: 'ticket:btn:stats',
  proof: 'ticket:btn:proof',
  tradeInfo: 'ticket:btn:trade-info',
} as const;

/** Category key whose tickets get the extra "trade info" button (middleman/وسيط مضمون). */
export const TRADE_INFO_CATEGORY_KEY = 'middleman';

export const TRIAL_MANAGER_ID = process.env.TRIAL_MANAGER_ID || '1029665419788832800';

export const TRIAL_BUTTON_IDS = {
  close: 'trial_close_ticket',
  accept: 'trial_accept',
  reject: 'trial_reject',
} as const;

export const CHECK_BUTTON_PREFIXES = {
  user: 'check_trial_user:',
  guild: 'check_trial_guild:',
} as const;

export const MEMBER_MODAL_FIELD_ID = 'member_input';

export function isOpenTicketModal(customId: string): boolean {
  return customId.startsWith(OPEN_TICKET_MODAL_PREFIX);
}

export function extractOpenTicketCategoryKey(customId: string): string | null {
  if (!isOpenTicketModal(customId)) {
    return null;
  }

  return customId.slice(OPEN_TICKET_MODAL_PREFIX.length) || null;
}

export const ALLOWED_ADMIN_IDS = [
  '959896496113844254',
  '1148258174474928249',
  '1397364822152315052'
] as const;

export function isAuthorizedAdmin(userId: string): boolean {
  return ALLOWED_ADMIN_IDS.includes(userId as any);
}
