export const OPEN_TICKET_MODAL_PREFIX = 'ticket:modal:open:';
export const ADD_MEMBER_MODAL_ID = 'ticket:modal:add-member';
export const REMOVE_MEMBER_MODAL_ID = 'ticket:modal:remove-member';
export const APPLY_MEDIATOR = 'apply_mediator_role';

export const TICKET_BUTTON_IDS = {
  close: 'ticket:btn:close',
  add: 'ticket:btn:add',
  remove: 'ticket:btn:remove',
  claim: 'ticket:btn:claim',
  pin: 'ticket:btn:pin',
  stats: 'ticket:btn:stats',
  proof: 'ticket:btn:proof',
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
