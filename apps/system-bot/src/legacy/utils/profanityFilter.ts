// ══════════════════════════════════════════════════════════════
//  Opus System Bot V2 — Advanced Profanity Filter Engine
//  Multi-layer detection: Arabic, English, Multi-language
//  Handles obfuscation, mixed scripts, Levenshtein distance
// ══════════════════════════════════════════════════════════════

// ── Result Type ─────────────────────────────────────────────
export interface FilterResult {
  detected: boolean;
  word: string;
  type: string; // 'exact' | 'obfuscated' | 'fuzzy' | 'pattern'
}

// ── Whitelisted Phrases ─────────────────────────────────────
// These phrases are safe and must NEVER trigger the filter
const WHITELIST: string[] = [
  "كل زق",
  "كل تبن",
  "كلزق",
  "كلتبن",
  "زقه",
  "تبن",
  "زق",
];

// ── Arabic Swear Words Database ─────────────────────────────
const ARABIC_SWEARS: string[] = [
  // Sexual / Genital insults
  "كس", "كسم", "كسمك", "كسامك", "كس امك", "كسختك", "كس اختك",
  "كسك", "كسها", "كسه", "كس ابوك", "كس ام",
  "زب", "زبي", "زبك", "زبر", "زبره",
  "طيز", "طيزك", "طيزي", "طيزها",
  "نيك", "انيك", "انيكك", "نيكك", "نيكني", "ينيك", "ينيكك",
  "نايك", "نايكك", "نيكها", "انيكها", "تنيك", "منيوك", "منيوكه",
  "متناك", "متناكه", "تتناك", "يتناك", "نياك", "نياكه",
  "احا", "اح",
  "عرص", "عرصه", "عرصة", "عرصات",
  "شرموط", "شرموطه", "شرموطة", "شراميط",
  "قحبه", "قحبة", "قحاب",
  "فاجر", "فاجره", "فجره", "فجرة",
  "زاني", "زانيه", "زانية", "زناة", "زنا",
  "زانيه", "زنوه", "زنوة",
  "لبوه", "لبوة",
  "معرص", "معرصه", "معرصة",
  "ديوث", "ديوثي",
  "خنيث", "خنيثه", "خنيثة", "خنثى", "خنث",
  "مخنث", "مخنثه", "مخنثة",
  "لوطي", "لواط", "لواطي",
  "سحاق", "سحاقيه", "سحاقية",
  "بظر", "بظرك",
  "ثدي", "بزاز", "بزازك",
  "حلمه", "حلمة",

  // Mother/Father/Sister insults
  "ام", "يا ابن", "ابن ال",
  "كس ام", "نيك ام", "يلعن ام",
  "ابن القحبه", "ابن القحبة", "ابن الشرموطه", "ابن الشرموطة",
  "ابن الزانيه", "ابن الزانية",
  "يلعن ابوك", "يلعن اخوك", "يلعن اختك",
  "اخو الشرموطه", "اخو القحبه",
  "يا ابن الكلب", "ابن كلب", "ابن الكلب",
  "ابوك كلب", "امك كلبه",
  "اخت الشرموطه",

  // General insults
  "كلب", "كلبه", "كلبة", "كلاب",
  "حمار", "حماره", "حمارة", "حمير",
  "خنزير", "خنزيره", "خنزيرة", "خنازير",
  "غبي", "غبيه", "غبية", "اغبياء",
  "حيوان", "حيوانه", "حيوانة",
  "تيس", "تيسه",
  "ثور", "ثوره",
  "بقره", "بقرة",
  "وسخ", "وسخه", "وسخة", "اوساخ",
  "قذر", "قذره", "قذرة",
  "زباله", "زبالة",
  "حقير", "حقيره", "حقيرة",
  "نجس", "نجسه", "نجسة",
  "خايس", "خايسه",
  "منحط", "منحطه", "منحطة",
  "وضيع", "وضيعه", "وضيعة",
  "ساقط", "ساقطه", "ساقطة",
  "تافه", "تافهه", "تافهة",
  "مقرف", "مقرفه", "مقرفة",
  "اهبل", "هبل", "هبله", "هبلة",
  "معاق", "معاقه", "معاقة",
  "مجنون", "مجنونه", "مجنونة",
  "مريض", "مريضه", "مريضة",
  "خول", "خوله",
  "شاذ", "شاذه", "شاذة",
  "عاهر", "عاهره", "عاهرة",
  "فاسق", "فاسقه", "فاسقة",
  "ملعون", "ملعونه", "ملعونة",
  "مسخره", "مسخرة",
  "جحش", "جحشه",
  "بهيم", "بهيمه", "بهيمة",
  "عبيط", "عبيطه",
  "اطرم", "طرمه",
  "اخس", "خسيس", "خسيسه",

  // Curse/Damning words
  "يلعن", "لعنه", "لعنة", "ملعون",
  "الله يلعنك", "الله يلعن", "يلعن ابوك",
  "الله لا يوفقك",
  "تلحس", "لحس", "الحس",
  "مص", "امص", "مصي",

  // Vulgar expressions
  "طز", "طزفيك",
  "روح انقبر", "انقبر",
  "انطم", "اسكت", "خرس",
  "وجهك", "شكلك",
  "اقرع",

  // Common colloquial insults
  "حثاله", "حثالة",
  "زفت",
  "منيه", "منية", "مني",
  "يخرب", "يخرب بيتك",
  "عيب", "عيبك",
  "قرد", "قرده", "قردة",
  "بغل", "بغله",
];

// ── English Swear Words Database ────────────────────────────
const ENGLISH_SWEARS: string[] = [
  "fuck", "fucker", "fucking", "fucked", "fck", "fuk", "phuck",
  "motherfucker", "motherfucking", "mf", "mfer",
  "shit", "shitty", "bullshit", "shitting",
  "bitch", "bitches", "bitchy", "biatch",
  "ass", "asshole", "arse", "arsehole",
  "dick", "dickhead", "dck",
  "pussy", "pussies",
  "cock", "cocksucker",
  "cunt", "cunts",
  "whore", "hoe", "slut", "slutty",
  "bastard", "bastards",
  "damn", "damned",
  "nigga", "nigger", "negro", "nig",
  "faggot", "fag", "faggy",
  "retard", "retarded",
  "idiot", "moron", "dumb",
  "stfu", "gtfo", "kys",
  "penis", "vagina",
  "boob", "boobs", "tits", "titties",
  "wanker", "tosser", "twat", "bellend",
  "piss", "pissed", "pissing",
  "crap", "crappy",
  "suck", "sucker", "smd",
  "rape", "rapist",
];

// ── Multi-Language Swear Words ──────────────────────────────
const MULTILANG_SWEARS: string[] = [
  // Turkish
  "amk", "amina", "sik", "sikik", "orospu", "piç", "yarak", "yarrak",
  "göt", "gotten", "ananı", "anan", "sikerim", "sikeyim",
  // Spanish
  "puta", "puto", "mierda", "pendejo", "cabron", "cabrón", "coño",
  "verga", "chingar", "joder", "maricón", "maricon",
  // French
  "merde", "putain", "salope", "connard", "connasse", "enculé", "encule",
  "nique", "niqueta", "niquer", "bordel", "batard", "bâtard",
  // Farsi/Persian
  "کس", "کیر", "کسکش", "جنده", "کونی", "گاییدن", "حرومزاده",
  "مادرجنده", "خایه", "لاشی",
  // Urdu/Hindi
  "بھنچود", "مادرچود", "چوتیا", "گانڈ", "لوڑا", "بھوسڑی",
  "chutiya", "bhenchod", "madarchod", "gaand", "lauda", "bhosdike",
  // German
  "scheiße", "scheisse", "hurensohn", "wichser", "arschloch", "fotze",
  // Portuguese
  "caralho", "foda", "fodase", "porra", "buceta",
  // Italian
  "cazzo", "merda", "stronzo", "puttana", "vaffanculo", "minchia",
  // Russian transliterated
  "suka", "blyat", "blyad", "pizdec", "nahui", "ebat",
];

// ── Arabic Letter Mapping for Normalization ─────────────────
const ARABIC_NORMALIZATION: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي",
  "گ": "ك",
  "ڤ": "ف",
  "پ": "ب",
  "چ": "ج",
  "ژ": "ز",
};

// ── English Leet Speak / Substitution Map ───────────────────
const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "8": "b", "@": "a", "$": "s", "!": "i",
  "|": "l", "+": "t",
};

// ══════════════════════════════════════════════════════════════
//  NORMALIZATION FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Remove Arabic diacritics (tashkeel/harakat)
 */
function removeDiacritics(text: string): string {
  // Arabic diacritics range: U+0610-U+061A, U+064B-U+065F, U+0670, U+06D6-U+06DC, U+06DF-U+06E8, U+06EA-U+06ED
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
}

/**
 * Remove zero-width characters, invisible unicode, and control chars
 */
function removeInvisibleChars(text: string): string {
  return text.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD\u034F\u061C\u180E]/g, "");
}

/**
 * Normalize Arabic characters (variants → standard form)
 */
function normalizeArabic(text: string): string {
  let result = "";
  for (const ch of text) {
    result += ARABIC_NORMALIZATION[ch] ?? ch;
  }
  return result;
}

/**
 * Decode leet speak / character substitutions for English text
 */
function decodeLeet(text: string): string {
  let result = "";
  for (const ch of text.toLowerCase()) {
    result += LEET_MAP[ch] ?? ch;
  }
  return result;
}

/**
 * Remove repeated characters (more than 2 consecutive → 1)
 * e.g. "fuuuuck" → "fuck", "كسسسسمك" → "كسمك"
 */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1{2,}/g, "$1");
}

/**
 * Strip common separators between letters (spaces, dots, dashes, underscores, etc.)
 */
function stripSeparators(text: string): string {
  return text.replace(/[\s.\-_*~`|\/\\,;:!?'"\u200C\u200D]+/g, "");
}

/**
 * Full normalization pipeline
 */
function normalizeText(text: string): string {
  let normalized = text;
  normalized = removeInvisibleChars(normalized);
  normalized = removeDiacritics(normalized);
  normalized = normalizeArabic(normalized);
  normalized = normalized.toLowerCase();
  return normalized;
}

/**
 * Aggressive normalization (also strips separators and collapses repeats)
 */
function aggressiveNormalize(text: string): string {
  let normalized = normalizeText(text);
  normalized = stripSeparators(normalized);
  normalized = collapseRepeats(normalized);
  normalized = decodeLeet(normalized);
  return normalized;
}

// ══════════════════════════════════════════════════════════════
//  LEVENSHTEIN DISTANCE
// ══════════════════════════════════════════════════════════════

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,      // deletion
        dp[i]![j - 1]! + 1,      // insertion
        dp[i - 1]![j - 1]! + cost // substitution
      );
    }
  }
  return dp[m]![n]!;
}

// ══════════════════════════════════════════════════════════════
//  WHITELIST CHECKER
// ══════════════════════════════════════════════════════════════

function isWhitelisted(text: string): boolean {
  const normalized = aggressiveNormalize(text);
  const normalizedSpaced = normalizeText(text);

  for (const safe of WHITELIST) {
    const safeNorm = aggressiveNormalize(safe);
    const safeSpaced = normalizeText(safe);
    if (normalized === safeNorm || normalizedSpaced.includes(safeSpaced)) {
      return true;
    }
    if (normalized.includes(safeNorm)) {
      return true;
    }
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
//  DETECTION LAYERS
// ══════════════════════════════════════════════════════════════

/**
 * Layer 1: Exact Match — check if normalized text contains any swear word
 */
function exactMatch(text: string, words: string[]): FilterResult {
  const normalized = normalizeText(text);
  const tokens = normalized.split(/\s+/);

  for (const swear of words) {
    const swearNorm = normalizeText(swear);

    // Token-level match
    for (const token of tokens) {
      if (token === swearNorm || token.includes(swearNorm)) {
        return { detected: true, word: swear, type: "exact" };
      }
    }

    // Substring match for compound words
    if (normalized.includes(swearNorm) && swearNorm.length >= 3) {
      return { detected: true, word: swear, type: "exact" };
    }
  }
  return { detected: false, word: "", type: "" };
}

/**
 * Layer 2: Obfuscation Detection — strip separators and check again
 */
function obfuscationMatch(text: string, words: string[]): FilterResult {
  const aggressive = aggressiveNormalize(text);

  for (const swear of words) {
    const swearAgg = aggressiveNormalize(swear);
    if (swearAgg.length < 2) continue;

    if (aggressive.includes(swearAgg)) {
      return { detected: true, word: swear, type: "obfuscated" };
    }
  }
  return { detected: false, word: "", type: "" };
}

/**
 * Layer 3: Fuzzy / Levenshtein Match — catch typos and close approximations
 */
function fuzzyMatch(text: string, words: string[]): FilterResult {
  const tokens = aggressiveNormalize(text).split(/\s+/);

  for (const token of tokens) {
    if (token.length < 3) continue;

    for (const swear of words) {
      const swearAgg = aggressiveNormalize(swear);
      if (swearAgg.length < 3) continue;

      // Only use fuzzy matching for words of similar length
      const lenDiff = Math.abs(token.length - swearAgg.length);
      if (lenDiff > 2) continue;

      const maxDist = swearAgg.length <= 4 ? 1 : 2;
      const dist = levenshteinDistance(token, swearAgg);

      if (dist > 0 && dist <= maxDist) {
        return { detected: true, word: swear, type: "fuzzy" };
      }
    }
  }
  return { detected: false, word: "", type: "" };
}

/**
 * Layer 4: Pattern-based detection for common Arabic insult structures
 */
function patternMatch(text: string): FilterResult {
  const normalized = normalizeText(text);
  const aggressive = aggressiveNormalize(text);

  // Common patterns for Arabic insults
  const patterns: Array<{ regex: RegExp; desc: string }> = [
    // "كس + family member" pattern
    { regex: /كس\s*(ا?م|اب|اخ|اخت|عم|خال)/u, desc: "كس + family" },
    // "نيك/انيك + family member"
    { regex: /(ا?ن[يى]ك|ت?ن[يى]ك)\s*(ا?م|اب|اخ|اخت)/u, desc: "نيك + family" },
    // "ابن ال + insult"
    { regex: /ابن\s*ال?(كلب|قحب|شرموط|زاني|حرام|عاهر|لبو)/u, desc: "ابن + insult" },
    // "يلعن + family"
    { regex: /يلعن\s*(ا?م|اب|اخ|اخت|دين)/u, desc: "يلعن + target" },
    // "يا + insult" (addressing someone with an insult)
    { regex: /يا\s*(كلب|حمار|خنزير|حيوان|غبي|ديوث|خنيث|شرموط|قحب|عرص|منيوك|متناك)/u, desc: "يا + insult" },
    // "اخو/اخت ال + insult"
    { regex: /(اخو|اخت)\s*ال?(شرموط|قحب|كلب|زاني|عاهر)/u, desc: "اخو/اخت + insult" },
  ];

  for (const { regex, desc } of patterns) {
    if (regex.test(normalized) || regex.test(aggressive)) {
      return { detected: true, word: desc, type: "pattern" };
    }
  }

  return { detected: false, word: "", type: "" };
}

/**
 * Layer 5: Mixed Script Detection — e.g. English letters mixed into Arabic swears
 * Catches attempts like "kس امك" or "fاك"
 */
function mixedScriptMatch(text: string): FilterResult {
  const normalized = normalizeText(text);

  // English-to-Arabic letter approximations
  const mixedMap: Record<string, string> = {
    "k": "ك", "s": "س", "f": "ف", "n": "ن",
    "t": "ت", "b": "ب", "h": "ه", "d": "د",
    "r": "ر", "z": "ز", "m": "م", "a": "ا",
    "w": "و", "y": "ي", "l": "ل", "g": "ج",
    "q": "ق", "7": "ح", "5": "خ", "9": "ص",
    "6": "ط", "3": "ع", "2": "ء",
  };

  // Try replacing English/number chars with Arabic equivalents
  let arabicized = "";
  for (const ch of normalized) {
    arabicized += mixedMap[ch] ?? ch;
  }

  // Check the arabicized version against Arabic swears
  const allArabic = [...ARABIC_SWEARS];
  const result = exactMatch(arabicized, allArabic);
  if (result.detected) {
    return { ...result, type: "mixed_script" };
  }

  const obfResult = obfuscationMatch(arabicized, allArabic);
  if (obfResult.detected) {
    return { ...obfResult, type: "mixed_script" };
  }

  return { detected: false, word: "", type: "" };
}

// ══════════════════════════════════════════════════════════════
//  MAIN FILTER FUNCTION
// ══════════════════════════════════════════════════════════════

/**
 * Run the full profanity filter pipeline on a message.
 * Returns FilterResult with detection status, matched word, and detection type.
 */
export function checkProfanity(text: string): FilterResult {
  // Skip very short messages
  if (text.trim().length < 2) {
    return { detected: false, word: "", type: "" };
  }

  // Check whitelist first — whitelisted phrases are always safe
  if (isWhitelisted(text)) {
    return { detected: false, word: "", type: "" };
  }

  const allWords = [...ARABIC_SWEARS, ...ENGLISH_SWEARS, ...MULTILANG_SWEARS];

  // Layer 1: Exact match
  const exact = exactMatch(text, allWords);
  if (exact.detected) {
    // Double-check it's not a whitelisted phrase containing the word
    if (!isWhitelisted(text)) return exact;
  }

  // Layer 2: Obfuscation detection
  const obfuscated = obfuscationMatch(text, allWords);
  if (obfuscated.detected) {
    if (!isWhitelisted(text)) return obfuscated;
  }

  // Layer 3: Pattern-based Arabic insult detection
  const pattern = patternMatch(text);
  if (pattern.detected) return pattern;

  // Layer 4: Mixed script detection
  const mixed = mixedScriptMatch(text);
  if (mixed.detected) return mixed;

  // Layer 5: Fuzzy/Levenshtein matching (only for Arabic and English, not multi-lang)
  const fuzzyWords = [...ARABIC_SWEARS, ...ENGLISH_SWEARS];
  const fuzzy = fuzzyMatch(text, fuzzyWords);
  if (fuzzy.detected) {
    if (!isWhitelisted(text)) return fuzzy;
  }

  return { detected: false, word: "", type: "" };
}

// ══════════════════════════════════════════════════════════════
//  SPAM DETECTION UTILITIES
// ══════════════════════════════════════════════════════════════

export interface SpamTrackData {
  count: number;
  lastTime: number;
  lastContent: string;
  duplicateCount: number;
  mentionCount: number;
}

const spamTracker = new Map<string, SpamTrackData>();

const SPAM_CONFIG = {
  maxMessages: 5,        // Max messages in window
  windowMs: 5000,        // 5 second window
  maxDuplicates: 3,      // Max identical messages
  maxMentions: 5,        // Max mentions per message
  timeoutMs: 60 * 1000,  // 1 minute timeout for spam
};

/**
 * Track and detect spam behavior.
 * Returns true if the user is spamming.
 */
export function checkSpam(userId: string, content: string, mentionCount: number): boolean {
  const now = Date.now();
  const data = spamTracker.get(userId) || {
    count: 0,
    lastTime: now,
    lastContent: "",
    duplicateCount: 0,
    mentionCount: 0,
  };

  // Reset if outside window
  if (now - data.lastTime > SPAM_CONFIG.windowMs) {
    data.count = 1;
    data.lastTime = now;
    data.duplicateCount = 0;
    data.lastContent = content;
    data.mentionCount = mentionCount;
    spamTracker.set(userId, data);
    return false;
  }

  data.count++;
  data.mentionCount += mentionCount;

  // Check duplicate messages
  if (content === data.lastContent) {
    data.duplicateCount++;
  } else {
    data.duplicateCount = 0;
    data.lastContent = content;
  }

  spamTracker.set(userId, data);

  // Spam conditions
  if (data.count > SPAM_CONFIG.maxMessages) return true;
  if (data.duplicateCount >= SPAM_CONFIG.maxDuplicates) return true;
  if (data.mentionCount > SPAM_CONFIG.maxMentions) return true;

  return false;
}

/**
 * Reset spam tracker for a user
 */
export function resetSpamTracker(userId: string): void {
  spamTracker.delete(userId);
}

export { SPAM_CONFIG };
