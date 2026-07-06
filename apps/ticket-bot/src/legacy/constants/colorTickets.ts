// ════════════════════════════════════════════════════════════════
//  Color ("الوان البيوت") ticket definitions — server 1413059459630104626 ONLY.
//  Each color = a fixed category + a fixed button + a fixed role.
//  This data is intentionally hardcoded: the categories/roles/emojis are
//  specific to this one server, so nothing here is guessed or generated.
// ════════════════════════════════════════════════════════════════

// Only this guild ever provisions/uses the color ticket system.
export const COLOR_GUILD_ID = '1413059459630104626';

// Button custom_id shapes:
// - color_ticket_<slug>      (regular house colors)
// - jump_color_ticket_<slug> ("ماب النطة" house colors)
export const STANDARD_HOUSE_COLOR_CATEGORY_KEY = 'house_unlock';
export const JUMP_MAP_HOUSE_COLOR_CATEGORY_KEY = 'house_unlock_jump';
export const COLOR_TICKET_BUTTON_PREFIX = 'color_ticket_';
export const JUMP_COLOR_TICKET_BUTTON_PREFIX = 'jump_color_ticket_';

// Categories that were created by mistake in the past and must never exist.
// /setup-color deletes any matching category and never recreates it.
export const FORBIDDEN_COLOR_CATEGORY_NAMES = ['Tickets Gold .:', 'Tickets Gold'];

export interface ColorTicketDef {
  slug: string;
  categoryName: string; // exact Discord category name to reuse/create
  buttonLabel: string;
  emojiId?: string; // application/custom emoji id (optional)
  roleId: string; // the color role that can see + write in the ticket
  channelColor: string; // clean Arabic color name used in the channel name
}

export const COLOR_TICKETS: ColorTicketDef[] = [
  { slug: 'christmas', categoryName: 'Tickets Christmas .:', buttonLabel: 'لـون・الـكرسمس', roleId: '1483208858901020903', channelColor: 'كرسمس' },
  { slug: 'halloween', categoryName: 'Tickets Halloween .:', buttonLabel: 'لـون・الـهالوين', emojiId: '1509800195851030618', roleId: '1483208475227193555', channelColor: 'هالوين' },
  { slug: 'dreamy', categoryName: 'Tickets Dreamy .:', buttonLabel: 'لـون・الـدريمي', emojiId: '1509798677638807606', roleId: '1483208671126356118', channelColor: 'دريمي' },
  { slug: 'darkness', categoryName: 'Tickets Darkness .:', buttonLabel: 'لـون・الـداركنس', emojiId: '1509798442484891758', roleId: '1483212750074417212', channelColor: 'داركنس' },
  { slug: 'lovely', categoryName: 'Tickets Lovely .:', buttonLabel: 'لـون・لوفلي', emojiId: '1509799754702262494', roleId: '1486862867767492890', channelColor: 'لوفلي' },
  { slug: 'chocolate', categoryName: 'Tickets Chocolate .:', buttonLabel: 'لـون・التشوكلت', emojiId: '1509797654895525898', roleId: '1505377527257104495', channelColor: 'تشوكلت' },
  { slug: 'heaven', categoryName: 'Tickets Heaven .:', buttonLabel: 'لـون・الهيفين', emojiId: '1509799253961347144', roleId: '1505310496004378766', channelColor: 'هيفن' },
  { slug: 'crystal', categoryName: 'Tickets Crystal .:', buttonLabel: 'لـون・الكريستال', emojiId: '1509798027211047012', roleId: '1496651113003352188', channelColor: 'كريستال' },
  { slug: 'void', categoryName: 'Tickets Void .:', buttonLabel: 'لـون・الـفويد', emojiId: '1509988829522690251', roleId: '1484730388898123806', channelColor: 'فويد' },
  { slug: 'toxic', categoryName: 'Tickets Toxic .:', buttonLabel: 'لـون・التوكسيك', emojiId: '1509988206165364938', roleId: '1506083939679469769', channelColor: 'توكسيك' },
  { slug: 'aqua', categoryName: 'Tickets Aqua .:', buttonLabel: 'لـون・الاكوا', emojiId: '1509797157836685373', roleId: '1504574828579913798', channelColor: 'اكوا' },
  { slug: 'rainbow', categoryName: 'Tickets Rainbow .:', buttonLabel: 'لـون・الرينبو', emojiId: '1509797307665743974', roleId: '1498410561287753848', channelColor: 'رينبو' },
  { slug: 'magic', categoryName: 'Tickets Magic .:', buttonLabel: 'لـون・الماجيك', emojiId: '1509799994763247666', roleId: '1506346113580667111', channelColor: 'ماجيك' },
  { slug: 'carnival', categoryName: 'Tickets Carnival .:', buttonLabel: 'لـون・الـكرنفال', emojiId: '1509797507641774111', roleId: '1512858226348265613', channelColor: 'كرنفال' },
  { slug: 'zombie', categoryName: 'Tickets Zombie .:', buttonLabel: 'لـون・الزومبي', emojiId: '1509988433081143479', roleId: '1504574981953294437', channelColor: 'زومبي' },
  { slug: 'neon', categoryName: 'Tickets Neon .:', buttonLabel: 'لـون・النيون', emojiId: '1509800145104011375', roleId: '1509656348831387881', channelColor: 'نيون' },
  { slug: 'gothic', categoryName: 'Tickets Gothic .:', buttonLabel: 'لـون・القوثيك', emojiId: '1522966188769153214', roleId: '1513240867052458035', channelColor: 'قوثيك' },
  { slug: 'ice_fire', categoryName: 'Tickets Ice Fire .:', buttonLabel: 'لـون・الآيس-فاير', emojiId: '1509799313864392886', roleId: '1514697732638380072', channelColor: 'ايس-فاير' },
  { slug: 'football', categoryName: 'Tickets Football .:', buttonLabel: 'لـون・الفوتبول', emojiId: '1522966224521138186', roleId: '1523426437917577337', channelColor: 'فوتبول' },
];

export const JUMP_MAP_COLOR_TICKETS: ColorTicketDef[] = [
  { slug: 'cyber', categoryName: 'Tickets Jump Cyber .:', buttonLabel: 'لون・سايبر', emojiId: '1509798027211047012', roleId: '1520245827526721566', channelColor: 'سايبر' },
  { slug: 'aqua', categoryName: 'Tickets Jump Aqua .:', buttonLabel: 'لون・اكوا', emojiId: '1509797157836685373', roleId: '1519160928807948298', channelColor: 'اكوا' },
  { slug: 'candy', categoryName: 'Tickets Jump Candy .:', buttonLabel: 'لون・كاندي', emojiId: '1523697811173146796', roleId: '1520245672815624232', channelColor: 'كاندي' },
  { slug: 'party', categoryName: 'Tickets Jump Party .:', buttonLabel: 'لون・البارتي', emojiId: '1509797507641774111', roleId: '1520134074512179271', channelColor: 'بارتي' },
  { slug: 'lava', categoryName: 'Tickets Jump Lava .:', buttonLabel: 'لون・اللافا', emojiId: '1509798442484891758', roleId: '1519161212804399104', channelColor: 'لافا' },
];

export const ALL_COLOR_TICKETS: ColorTicketDef[] = [...COLOR_TICKETS, ...JUMP_MAP_COLOR_TICKETS];

export interface ColorTicketSelection {
  color: ColorTicketDef;
  categoryKey: string;
}

export function getColorTicketSelectionFromCustomId(customId: string): ColorTicketSelection | undefined {
  if (customId.startsWith(COLOR_TICKET_BUTTON_PREFIX)) {
    const slug = customId.slice(COLOR_TICKET_BUTTON_PREFIX.length);
    const color = COLOR_TICKETS.find((item) => item.slug === slug);
    return color ? { color, categoryKey: STANDARD_HOUSE_COLOR_CATEGORY_KEY } : undefined;
  }

  if (customId.startsWith(JUMP_COLOR_TICKET_BUTTON_PREFIX)) {
    const slug = customId.slice(JUMP_COLOR_TICKET_BUTTON_PREFIX.length);
    const color = JUMP_MAP_COLOR_TICKETS.find((item) => item.slug === slug);
    return color ? { color, categoryKey: JUMP_MAP_HOUSE_COLOR_CATEGORY_KEY } : undefined;
  }

  return undefined;
}
