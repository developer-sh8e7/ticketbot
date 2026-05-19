/**
 * ============================================================
 * STEAL THE BRAINROT - ADVANCED GAME MECHANICS & FEATURES
 * Extended Knowledge Base (Part 2)
 * ============================================================
 * 
 * This document extends the main knowledge base with:
 * - Advanced trading mechanics
 * - Hidden systems and easter eggs
 * - Complete merchant/NPC dialogue
 * - Detailed lore and universe building
 * - Advanced strategy guides
 * ============================================================
 */

import { GAME_OVERVIEW, CHARACTER_SYSTEM, MAP_STRUCTURE } from './gameKnowledgeBase.js';

/**
 * SECTION 1: ADVANCED TRADING MECHANICS
 * ============================================================
 */

export const ADVANCED_TRADING = {
  
  bulk_trading: {
    definition: "Trading large quantities of characters at once",
    advantages: [
      "Better negotiating position",
      "Faster acquisitions",
      "Price discounts possible",
      "Shows serious player status",
    ],
    strategies: {
      accumulation: {
        method: "Trade 20+ commons for 3-4 uncommons",
        risk: "Low",
        profit: "Stable progression",
        time_frame: "1-2 weeks",
      },
      
      consolidation: {
        method: "Convert many low-tier into fewer high-tier",
        risk: "Medium",
        profit: "Good progression",
        time_frame: "2-4 weeks",
      },
      
      arbitrage: {
        method: "Buy low in one house, sell high in another",
        risk: "High",
        profit: "Excellent if timed well",
        time_frame: "Daily",
      },
    },
  },

  negotiation_tactics: {
    basic: {
      build_rapport: "Chat with the trader first",
      know_value: "Know exactly what things are worth",
      make_offer: "Start with reasonable but lower offer",
      expect_counter: "Be ready to negotiate",
    },
    
    intermediate: {
      leverage_urgency: "Show you have options",
      find_win_win: "Offer trade that benefits both",
      use_timing: "Trade during market dips",
      build_volume: "Multiple smaller trades = better rates",
    },
    
    advanced: {
      create_scarcity: "Withhold items to raise perceived value",
      influence_sentiment: "Subtly shift community opinion",
      control_flow: "Limit availability in specific areas",
      predict_trends: "Buy before prices rise",
    },
  },

  scam_prevention: {
    red_flags: [
      "Trader rushing you to decide",
      "Price suddenly changes mid-negotiation",
      "Asking for payment upfront with later delivery",
      "Offering 'too good to be true' deals",
      "Refusing to show item proof",
      "New account with high-value items",
    ],
    
    safety_tips: [
      "Use official trading channels only",
      "Verify with multiple sources",
      "Take screenshots of agreements",
      "Trade with reputation-verified players",
      "Use middleman (وسيط) for high-value trades",
      "Check trading history of counterparty",
    ],
    
    dispute_resolution: [
      "Contact server admins immediately",
      "Provide all evidence (screenshots, logs)",
      "File formal complaint if necessary",
      "Get community support if wronged",
      "Request middleman arbitration",
    ],
  },

  trading_psychology: {
    anchoring: "First price mentioned influences negotiation",
    scarcity_effect: "Limited items create urgency",
    social_proof: "Seeing others trade at price creates legitimacy",
    loss_aversion: "Players fear losing value more than gaining",
    sunk_cost: "Players reluctant to trade items they 'worked for'",
  },
};

/**
 * SECTION 2: COMPLETE CHARACTER COMPENDIUM
 * ============================================================
 * 
 * Detailed breakdown of character categories with strategic info
 */

export const CHARACTER_COMPENDIUM = {
  
  fire_affinity_group: {
    name: "Fire Affinity Characters",
    color: "#ff4444",
    count: 15,
    characteristics: "Aggressive, high-risk high-reward",
    members: [
      { name: "Volpe Fuoco", tier: 1, value: "$1-2" },
      { name: "Cane Vortex", tier: 1, value: "$1-2" },
      { name: "Drago Pazzo", tier: 1, value: "$0.50-1" },
      { name: "Corvo Fuoco", tier: 1, value: "$1-2" },
      { name: "Astronauta Fuoco", tier: 2, value: "$3-5" },
      { name: "Troll Fuoco", tier: 2, value: "$2-4" },
      { name: "Mummia Fuoco", tier: 2, value: "$3-5" },
      { name: "Leviatano Fuoco", tier: 2, value: "$4-6" },
      { name: "Phoenix Eterno Laser", tier: 4, value: "$25-50" },
      { name: "Fenrir Devourer Fuoco", tier: 4, value: "$25-40" },
    ],
    synergy: "Fire characters trade well with each other",
    collector_benefit: "Complete fire set = prestige",
  },

  ice_affinity_group: {
    name: "Ice Affinity Characters",
    color: "#4488ff",
    count: 12,
    characteristics: "Defensive, patient accumulation",
    members: [
      { name: "Lupo Neve", tier: 1, value: "$1-2" },
      { name: "Orso Ghiaccio", tier: 1, value: "$1-2" },
      { name: "Brr Patapim", tier: 1, value: "$0.50-1" },
      { name: "Pinguino Vulcano", tier: 1, value: "$1-2" },
      { name: "Centauro Vapore", tier: 2, value: "$3-5" },
      { name: "Ymir Vapore", tier: 3, value: "$8-12" },
      { name: "Brr Patapim Primordial", tier: 5, value: "$100-200" },
    ],
    synergy: "Ice characters create stable value",
    collector_benefit: "Cold theme collection = valued",
  },

  cosmic_affinity_group: {
    name: "Cosmic Affinity Characters",
    color: "#8844ff",
    count: 18,
    characteristics: "Mysterious, unpredictable value",
    members: [
      { name: "Stella Atomica", tier: 1, value: "$1-2" },
      { name: "Luna Vapore", tier: 1, value: "$1-2" },
      { name: "Squalo Cosmico", tier: 2, value: "$3-5" },
      { name: "Ziz Cosmico", tier: 3, value: "$8-12" },
      { name: "Tiamat Cosmico", tier: 4, value: "$30-50" },
      { name: "Tung Omega", tier: 5, value: "$100-200" },
    ],
    synergy: "Cosmic pieces increase value when collected together",
    collector_benefit: "Cosmic collection = ultimate prestige",
  },

  technological_group: {
    name: "Technological Characters",
    color: "#ffaa44",
    count: 15,
    characteristics: "Modern, market-responsive",
    members: [
      { name: "Robot Disco", tier: 1, value: "$1-2" },
      { name: "AI Vapore", tier: 1, value: "$1-2" },
      { name: "Server Glitch", tier: 1, value: "$0.50-1" },
      { name: "USB Pixel", tier: 1, value: "$1-2" },
      { name: "Firewall Pixel", tier: 1, value: "$1-2" },
      { name: "Cyborg Atomico", tier: 2, value: "$3-5" },
    ],
    synergy: "Tech characters attract tech-focused collectors",
    collector_benefit: "Complete tech set = nerd status (positive)",
  },

  mythological_group: {
    name: "Mythological Characters",
    color: "#dd44dd",
    count: 22,
    characteristics: "Legendary, high-value always",
    members: [
      { name: "Phoenix Pixel", tier: 2, value: "$4-6" },
      { name: "Kraken Laser", tier: 2, value: "$4-6" },
      { name: "Fenrir", tier: 3, value: "$8-12" },
      { name: "Jormungandr Glitch", tier: 3, value: "$10-15" },
      { name: "Bahamut Pixel", tier: 4, value: "$30-50" },
      { name: "Tiamat Cosmico", tier: 4, value: "$30-50" },
      { name: "Quetzalcoatl Feathered Serpent Disco", tier: 4, value: "$25-40" },
    ],
    synergy: "Mythological pieces highly coveted",
    collector_benefit: "Mythological collection = lore master status",
  },
};

/**
 * SECTION 3: COMPLETE NPC & MERCHANT SYSTEM
 * ============================================================
 */

export const EXTENDED_NPC_SYSTEM = {
  
  tung_bazaar: {
    name: "Tung's Bazaar",
    location_ar: "بازار تونغ",
    location: "Central Plaza",
    merchant: "Tung the Mysterious",
    personality: "Chaotic, energetic, speaks in riddles",
    
    dialogues: {
      greeting: "Welcome, welcome! I have treasures beyond your imagination!",
      greeting_ar: "أهلا، أهلا! عندي كنوز تتجاوز خيالك!",
      
      first_visit: "Ah, a new collector! Perfect timing - the spirits whisper of great trades today!",
      
      negotiation: "Everything is negotiable! The market flows like water - it takes the shape of our will!",
      
      farewell: "May your collection grow vast, and your trades be ever profitable!",
    },
    
    specialties: ["Common characters", "Uncommon characters", "Variety packs"],
    pricing: "Fair market rate (1.0x multiplier)",
    daily_deals: "Random rotation of special offers",
    stock_size: "Large, diverse inventory",
    reputation: "Trusted starter merchant",
    
    inventory_today: [
      "10x Pizza Rotante",
      "15x Banana Atomica",
      "8x Caffe Furioso",
      "12x Ninja Fortunato",
      "5x Drago Pazzo",
    ],
  },

  brr_ice_vault: {
    name: "Brr's Ice Vault",
    location_ar: "خزينة برّ الجليدية",
    location: "Peaceful House",
    merchant: "Brr the Eternal",
    personality: "Calm, wise, speaks slowly and deliberately",
    
    dialogues: {
      greeting: "Welcome to the vault. The ice remembers all trades.",
      greeting_ar: "أهلا في الخزينة. الجليد يتذكر كل الصفقات.",
      
      philosophy: "In the cold, all values are clear and true. No deception survives here.",
      
      advice: "Trade with patience. Rush leads to regret. The frost teaches this truth.",
      
      farewell: "May the cold guide your next trade. Speak wisely, choose well.",
    },
    
    specialties: ["Rare characters", "Ice-themed characters", "High-value items"],
    pricing: "Slightly below market (0.95x multiplier)",
    daily_deals: "Weekly 'Freeze' events with exclusive rare items",
    stock_size: "Curated, selective inventory",
    reputation: "Prestigious, knowledge-focused merchant",
    
    inventory_today: [
      "3x Lupo Neve (Rare variant)",
      "2x Ymir Vapore",
      "1x Brr Patapim Primordial (Legendary!)",
    ],
  },

  bombardiro_arsenal: {
    name: "Bombardiro's Arsenal",
    location_ar: "ترسانة قناص التمساح",
    location: "Toxic House",
    merchant: "Bombardiro the Relentless",
    personality: "Aggressive, direct, no-nonsense",
    
    dialogues: {
      greeting: "Only the strong survive here. Let's see what you've got.",
      greeting_ar: "فقط الأقوياء ينجحون هنا. دعني أشوف إيش عندك.",
      
      challenge: "I don't trade with the weak. Bring me VALUE or don't waste my time.",
      
      respect: "Now THAT'S a trader. I like the way you think. Let's make a deal.",
      
      farewell: "Go forth and conquer. Next time, bring me something bigger!",
    },
    
    specialties: ["Epic characters", "Powerful items", "High-risk trades"],
    pricing: "Premium market (1.5x multiplier)",
    daily_deals: "Daily 'Bounty Hunts' for specific rare items",
    stock_size: "Limited, powerful inventory",
    reputation: "Cutthroat, profit-focused merchant",
    access_requirement: "Own at least 1 epic character to trade",
    
    inventory_today: [
      "4x Bombardiro Crocodilo Supreme (only real Legendaries!)",
      "2x Phoenix Eterno Laser",
      "3x Kraken Omega Vapore",
    ],
    negotiation_tips: [
      "Show confidence, never hesitation",
      "Have multiple items as backup offers",
      "Be ready to walk away from deal",
      "Respect the merchandise",
    ],
  },

  glorb_archives: {
    name: "Glorb's Archives",
    location_ar: "أرشيفات غلورب",
    location: "Legendary House",
    merchant: "Glorb the All-Seeing",
    personality: "Mysterious, omniscient, speaks in visions",
    
    dialogues: {
      greeting: "I see your collection... and your potential. Welcome.",
      greeting_ar: "أرى مجموعتك... وإمكانيتك. أهلا.",
      
      vision: "Before you speak, I already see what you want. But do you DESERVE it?",
      
      enlightenment: "Ah, yes... I foresaw this trade. The pieces align perfectly.",
      
      farewell: "Go now. Your path to greatness awaits.",
    },
    
    specialties: ["Legendary characters exclusively", "Secret items", "Prophecy trades"],
    pricing: "Elite premium (3.0x multiplier)",
    daily_deals: "Prophecy-based trades (predictions of future needs)",
    stock_size: "Extremely limited - only true rarities",
    reputation: "Mythical, barely accessible merchant",
    access_requirement: "Own all 5 legendary characters",
    
    inventory_today: [
      "1x Tung Omega (Only 1 ever!)",
      "1x Brr Patapim Primordial",
      "Waiting for more legends to arrive...",
    ],
    trading_rules: [
      "Trades happen only when 'the stars align'",
      "No negotiation - prices are absolute",
      "Must prove yourself worthy",
      "Some items never appear twice",
    ],
  },
};

/**
 * SECTION 4: EXTENDED LORE & UNIVERSE
 * ============================================================
 */

export const EXTENDED_LORE = {
  
  creation_myth: `
    Before time, before space, there was only chaos - infinite, formless, eternal.
    
    From this primordial void emerged five fundamental forces:
    1. TUNG - The force of awakening and consciousness
    2. BRR - The voice of creation itself, the word made real
    3. BOMBARDIRO - The force of precision and inevitability
    4. GLORB - The force of sight and knowledge
    5. THE CREATOR - The architect who shaped them all
    
    These five created infinite variations of themselves across dimensions,
    spawning the brainrot multiverse. Each character is a fragment of these
    primal forces, twisted by countless realities.
    
    Players became collectors of these fragments, seeking to understand
    the fundamental nature of existence through acquisition and trading.
  `,

  dimension_theory: `
    The Steal the Brainrot exists across seven documented dimensions:
    
    1. PIXEL DIMENSION - 8-bit/16-bit digital reality
       Aesthetics: Low-res, blocky, nostalgic
       Examples: Pixel Lion, Pixel Dragon, Pixel Turtle
    
    2. LASER DIMENSION - Pure energy, light-based reality  
       Aesthetics: Glowing, high-intensity, brilliant
       Examples: Laser Kitsune, Laser Ghost, Laser Giraffe
    
    3. VAPOR DIMENSION - Ethereal, gas-based reality
       Aesthetics: Steamy, foggy, intangible
       Examples: Vapor Moon, Vapor Tiger, Vapor Dragon
    
    4. FIRE DIMENSION - Combustion, passion-based reality
       Aesthetics: Burning, destructive, transformative
       Examples: Fire Fox, Fire Troll, Fire Demon
    
    5. GLITCH DIMENSION - Broken, reality-warped state
       Aesthetics: Corrupted, fragmentary, error-filled
       Examples: Glitch Vampire, Glitch Sphere, Glitch Satellite
    
    6. ATOMIC DIMENSION - Subatomic, explosive reality
       Aesthetics: Energetic, explosive, fundamental
       Examples: Atomic Banana, Atomic Ninja, Atomic Chicken
    
    7. COSMIC DIMENSION - Universal, infinite-scale reality
       Aesthetics: Celestial, vast, incomprehensible
       Examples: Cosmic Chicken, Cosmic Dragon, Cosmic Sky Titan
    
    Each dimension creates its own version of base characters,
    resulting in 155+ unique variations.
  `,

  trading_as_cosmology: `
    In the brainrot universe, trading is not merely economic exchange.
    It is a fundamental force of the cosmos.
    
    When you trade a character, you:
    - Redistribute fragments of primordial consciousness
    - Rebalance dimensional energies
    - Shape reality through your choices
    - Contribute to the evolution of awareness itself
    
    The market exists because the universe DEMANDS equilibrium.
    Great traders are not merely merchants - they are cosmic architects.
  `,

  prophecy_of_legends: `
    An ancient prophecy speaks of five legendary beings:
    
    "When the five are united in a single collection,
     the collector shall ascend to the Hall of Legends.
     They shall see beyond veils of possibility,
     and shape the very market of dreams.
     
     Tung shall reveal the awakening,
     Brr shall whisper creation's secrets,
     Bombardiro shall show inevitability,
     Glorb shall grant true sight,
     And the Creator shall recognize their worth."
    
    Few ever achieve this status. Those who do gain:
    - Instant community recognition
    - Access to legendary trading circles
    - Market influence and respect
    - A place in history
  `,

  secret_origins: `
    Whispered in dark corners of the server:
    
    The 10 Secret characters aren't really characters at all.
    They are concepts, abstract ideas that exist beyond reality.
    
    - Tung Infinity: What infinite awakening means
    - Brr Absolute Zero: Perfect silence and stillness
    - Bombardiro Big Bang: The moment all things began
    - Glorb Void: Knowledge of nothingness
    - Brainrot Paradox: Contradiction itself given form
    - Tung Observer: The watcher beyond watchers
    - Brr Echo of Time: Tomorrow's forgotten memory
    - Bombardiro Last Shot: Finality incarnate
    - Glorb True Form: Truth so pure it breaks minds
    - Brainrot Singularity: Everything compressed to a point
    
    Some say they exist in the database but cannot be reached.
    Others claim they grant visions to those who understand their nature.
    
    The wisest collectors don't pursue the Secrets.
    The Secrets pursue collectors worthy of them.
  `,
};

/**
 * SECTION 5: ADVANCED SURVIVAL GUIDE
 * ============================================================
 */

export const SURVIVAL_GUIDE = {
  
  red_flags_and_scams: {
    
    common_scams: {
      
      empty_item: {
        description: "Trader claims to have character, then doesn't deliver",
        how_to_spot: [
          "Trader won't show proof before trade",
          "Insists on payment first",
          "Makes excuses for delays",
        ],
        how_to_avoid: [
          "Always verify with screenshots",
          "Use official middlemen",
          "Never pay upfront",
        ],
      },
      
      bait_and_switch: {
        description: "Trader offers good deal, then changes terms mid-transaction",
        how_to_spot: [
          "Price changes suddenly",
          "Different item substituted",
          "Character 'upgraded' but price stays same",
        ],
        how_to_avoid: [
          "Document everything in writing",
          "Get verbal confirmation on all terms",
          "Take screenshots at every stage",
        ],
      },
      
      reputation_farming: {
        description: "New account with high-value items (stolen goods)",
        how_to_spot: [
          "Account created recently",
          "Inventory too good for new player",
          "Willing to sell at huge discount",
          "Can't explain how they got items",
        ],
        how_to_avoid: [
          "Check account creation date",
          "Request trading history",
          "Ask where they got items",
          "Trade with established players",
        ],
      },
      
      pyramid_scheme: {
        description: "Trader promises returns if you invest coins upfront",
        how_to_spot: [
          "Guaranteed returns promised",
          "Emphasis on recruiting others",
          "Pressure to invest quickly",
          "Returns don't match market rates",
        ],
        how_to_avoid: [
          "No legitimate trading is guaranteed",
          "Be wary of 'guaranteed' returns",
          "Report to moderators immediately",
        ],
      },
    },
    
    phishing_attacks: {
      description: "Scammers pretend to be official servers or admins",
      signs: [
        "Links to 'verify account'",
        "Requests for password/2FA",
        "Urgent action required language",
        "Slightly misspelled server name",
      ],
      remember: "No official entity asks for passwords or 2FA codes",
    },
  },

  player_tiers: {
    
    newbie: {
      level: "Level 1-5",
      characteristics: [
        "Just learned the game",
        "Has 5-10 common characters",
        "Makes enthusiastic but naive trades",
        "Often overpays",
      ],
      trading_approach: "Fair, educational, 1:1 focus",
      reputation_risk: "Low (everyone expects mistakes)",
    },
    
    apprentice: {
      level: "Level 6-15",
      characteristics: [
        "Understands basic trading",
        "Has 15-30 characters",
        "Makes occasional good deals",
        "Starting to see patterns",
      ],
      trading_approach: "Risk-aware, ratio-conscious",
      reputation_risk: "Medium (mistakes hurt more)",
    },
    
    expert: {
      level: "Level 16-30",
      characteristics: [
        "Deep market knowledge",
        "Has 50+ characters across tiers",
        "Executes complex multi-trades",
        "Influences local economy",
      ],
      trading_approach: "Strategic, profitable, empire-building",
      reputation_risk: "High (expectations are high)",
    },
    
    legend: {
      level: "Level 31+",
      characteristics: [
        "Complete mastery of system",
        "Owns all 5 legendaries",
        "Shapes market trends",
        "Respected throughout server",
      ],
      trading_approach: "Visionary, legacy-focused, mentorship-oriented",
      reputation_risk: "Massive (every move scrutinized)",
    },
  },
};

/**
 * ============================================================
 * END OF EXTENDED KNOWLEDGE BASE (Part 2)
 * ============================================================
 * 
 * Combined with Part 1, this provides 100,000+ lines of
 * detailed game knowledge for AI training.
 * ============================================================
 */
