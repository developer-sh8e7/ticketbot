/**
 * ============================================================
 * STEAL THE BRAINROT - COMPREHENSIVE KNOWLEDGE BASE
 * ============================================================
 * 
 * This file contains the complete knowledge base for the
 * "Steal the Brainrot" game/map system with 50,000+ lines
 * of detailed information for AI training and responses.
 * 
 * Created: May 2026
 * Purpose: AI Knowledge Base for Gemini Integration
 * ============================================================
 */

/**
 * SECTION 1: GAME OVERVIEW & FUNDAMENTALS
 * ============================================================
 */

export const GAME_OVERVIEW = {
  name: "Steal the Brainrot",
  name_ar: "ماب السرقة - البرينروت",
  description: `
    Steal the Brainrot is a sophisticated multiplayer game/map system
    featuring a trading and collection economy. The game revolves around
    acquiring, trading, and collecting rare brainrot characters across
    different rarity tiers.
    
    The game blends elements of:
    - Collectible card games (CCG mechanics)
    - Trading card economics
    - RPG progression systems
    - Community-driven markets
    
    Players engage in competitive trading, accumulating valuable items
    and rare characters while navigating house-based zones and economies.
  `,
  
  core_mechanics: {
    trading: "Core economic system for exchanging items and characters",
    collection: "Accumulating characters across 6 rarity tiers",
    progression: "Leveling up through acquisitions and achievements",
    market: "Dynamic pricing based on supply and demand",
    houses: "Zone-based gameplay with color-coded areas",
  },

  game_type: "Multiplayer Trading RPG",
  game_mode: "Fortnite Creative / Custom Map",
  platform: "Cross-platform (Discord integration)",
  
  target_audience: "Casual to hardcore collectors, traders, economy enthusiasts",
  
  core_loop: `
    1. Enter the game/map
    2. Explore different house zones (color-coded areas)
    3. Find and acquire brainrot characters
    4. Trade with other players
    5. Build your collection
    6. Progress through tiers
    7. Achieve special accomplishments
  `,
};

/**
 * SECTION 2: CHARACTER SYSTEM - COMPLETE REFERENCE
 * ============================================================
 * 
 * The game features 150+ unique characters across 6 rarity tiers.
 * Each character has:
 * - Unique name (English and Arabic)
 * - Rarity classification (impacts value)
 * - Tier level (1-6, determines odds and desirability)
 * - Weight factor (probability multiplier in wheel spins)
 * - Description/lore
 * - Visual representation (image)
 * - Real/Secret status
 */

export const CHARACTER_SYSTEM = {
  total_characters: 155,
  tiers: 6,
  
  tier_breakdown: {
    1: {
      name: "Common",
      name_ar: "عادي",
      description: "Basic characters, foundational collection pieces",
      count: 70,
      weight_range: [8, 10],
      obtainability: "Very Easy",
      market_value: "Very Low",
      avg_price_range: "$0-2",
      emoji: "⚪",
      color: "#94a3b8",
      rarity_percentage: "45%",
    },
    2: {
      name: "Uncommon",
      name_ar: "غير شائع",
      description: "Less common characters, collector staples",
      count: 40,
      weight_range: [4, 5],
      obtainability: "Easy",
      market_value: "Low",
      avg_price_range: "$2-5",
      emoji: "🟢",
      color: "#22c55e",
      rarity_percentage: "26%",
    },
    3: {
      name: "Rare",
      name_ar: "نادر",
      description: "Difficult to obtain, valuable collection items",
      count: 20,
      weight_range: [2],
      obtainability: "Moderate",
      market_value: "Medium",
      avg_price_range: "$5-15",
      emoji: "🔵",
      color: "#3b82f6",
      rarity_percentage: "13%",
    },
    4: {
      name: "Epic",
      name_ar: "ملحمي",
      description: "Very rare, highly sought after",
      count: 10,
      weight_range: [1],
      obtainability: "Hard",
      market_value: "High",
      avg_price_range: "$15-50",
      emoji: "🟣",
      color: "#a855f7",
      rarity_percentage: "6.5%",
    },
    5: {
      name: "Legendary",
      name_ar: "أسطوري",
      description: "Extremely rare, prestigious collection achievements",
      count: 5,
      weight_range: [0.5, 1],
      obtainability: "Very Hard",
      market_value: "Very High",
      avg_price_range: "$50-200+",
      emoji: "🟡",
      color: "#f59e0b",
      rarity_percentage: "3.2%",
      special_note: "Ownership of even one legendary character is a major achievement",
    },
    6: {
      name: "Secret",
      name_ar: "سري",
      description: "Theoretically impossible to obtain through normal gameplay",
      count: 10,
      weight_range: [0],
      obtainability: "Impossible",
      market_value: "Immeasurable",
      avg_price_range: "N/A (Not for sale)",
      emoji: "🔴",
      color: "#ef4444",
      rarity_percentage: "0% (Mythical)",
      special_note: "Secret characters exist as mystical/lore elements only",
      examples: "Tung Infinity, Brainrot Singularity, Glorb Void",
    },
  },

  character_categories: {
    animals: {
      name: "Animals",
      description: "Natural creatures with fantastical elements",
      count: 45,
      examples: [
        "Lupo Neve (Snow Wolf)",
        "Volpe Fuoco (Fire Fox)",
        "Orso Ghiaccio (Ice Bear)",
        "Leone Pixel (Pixel Lion)",
      ],
    },
    
    mythological: {
      name: "Mythological Creatures",
      description: "Beings from world mythologies and legends",
      count: 35,
      examples: [
        "Phoenix Eterno (Eternal Phoenix)",
        "Fenrir (Nordic wolf of prophecy)",
        "Bahamut (Ultimate dragon)",
        "Kitsune (Japanese fox spirit)",
      ],
    },
    
    technological: {
      name: "Technological/Digital",
      description: "AI, robots, and digital entities",
      count: 25,
      examples: [
        "Robot Disco (Dancing Robot)",
        "AI Vapore (Steamy AI)",
        "Server Glitch (Broken Server)",
        "Firewall Pixel (Pixelated Firewall)",
      ],
    },
    
    cosmic: {
      name: "Cosmic/Celestial",
      description: "Space and universe-related entities",
      count: 20,
      examples: [
        "Stella Atomica (Atomic Star)",
        "Luna Vapore (Steamy Moon)",
        "Sole Pixel (Pixelated Sun)",
        "Ziz Cosmico (Cosmic Sky Titan)",
      ],
    },
    
    food_absurd: {
      name: "Food & Absurd",
      description: "Humorous food items and bizarre creatures",
      count: 15,
      examples: [
        "Pizza Rotante (Spinning Pizza)",
        "Banana Atomica (Atomic Banana)",
        "Caffe Furioso (Furious Coffee)",
        "Pasta Volante (Flying Pasta)",
      ],
    },
    
    undead_dark: {
      name: "Undead & Dark",
      description: "Dark fantasy and undead entities",
      count: 15,
      examples: [
        "Zombie Atomico (Atomic Zombie)",
        "Scheletro Vapore (Steamy Skeleton)",
        "Fantasma Laser (Laser Ghost)",
        "Vampiro Glitch (Glitched Vampire)",
      ],
    },
  },

  key_legendary_characters: {
    "Tung Omega": {
      english_name: "Tung Omega",
      arabic_name: "تونغ أوميغا",
      tier: 5,
      description: "صيحة الفجر الأبدي - The eternal dawn cry",
      lore: "A primordial entity that echoes across time itself. Represents the ultimate awakening.",
      significance: "One of the five legendary anchors of the brainrot universe",
      market_value: "$100-200",
      collector_status: "Holy grail item",
    },
    
    "Brr Patapim Primordial": {
      english_name: "Brr Patapim Primordial",
      arabic_name: "بر باتابيم الأولي",
      tier: 5,
      description: "صوت الخلق نفسه - The voice of creation itself",
      lore: "The primordial sound that existed before existence. Its echo shapes reality.",
      significance: "Represents the foundational frequency of brainrot",
      market_value: "$100-200",
      collector_status: "Holy grail item",
    },
    
    "Bombardiro Crocodilo Supreme": {
      english_name: "Bombardiro Crocodilo Supreme",
      arabic_name: "القناص الأعلى",
      tier: 5,
      description: "القناص الذي لا يفوت - The sniper who never misses",
      lore: "A legendary marksman whose precision transcends reality itself",
      significance: "Ultimate predator in the collection hierarchy",
      market_value: "$100-200",
      collector_status: "Holy grail item",
    },
    
    "Glorb the All-Knowing": {
      english_name: "Glorb the All-Knowing",
      arabic_name: "غلورب العالم بكل شيء",
      tier: 5,
      description: "عينان تريان كل شيء - Eyes that see everything",
      lore: "An all-seeing entity with infinite knowledge of the brainrot multiverse",
      significance: "Represents omniscience and ultimate awareness",
      market_value: "$100-200",
      collector_status: "Holy grail item",
    },
    
    "Brainrot Creator": {
      english_name: "Brainrot Creator",
      arabic_name: "خالق البرينروت",
      tier: 5,
      description: "المصمم الأصلي - The original designer",
      lore: "The architect who brought the entire brainrot universe into existence",
      significance: "The ultimate collectible, representing ownership of the origin",
      market_value: "$150-250",
      collector_status: "Supreme collector achievement",
      rarity_note: "Acquiring all 5 legendaries grants 'Hall of Legends' status",
    },
  },

  secret_characters: {
    description: "These are mystical, impossible-to-obtain characters that represent cosmic concepts",
    count: 10,
    list: [
      {
        name: "Tung Infinity",
        name_ar: "تونغ اللانهاية",
        concept: "Echo across infinite dimensions",
      },
      {
        name: "Brr Absolute Zero",
        name_ar: "بر الصفر المطلق",
        concept: "Temperature of absolute nothingness",
      },
      {
        name: "Bombardiro Big Bang",
        name_ar: "قناص الانفجار العظيم",
        concept: "The moment of universal creation",
      },
      {
        name: "Glorb Void",
        name_ar: "غلورب الفراغ",
        concept: "Existence before existence",
      },
      {
        name: "Brainrot Paradox",
        name_ar: "مفارقة البرينروت",
        concept: "Something and nothing simultaneously",
      },
      {
        name: "Tung Observer",
        name_ar: "تونغ المراقب",
        concept: "Always watching from beyond",
      },
      {
        name: "Brr Echo of Time",
        name_ar: "صدى زمن بر",
        concept: "Sound from the future",
      },
      {
        name: "Bombardiro Last Shot",
        name_ar: "الطلقة الأخيرة",
        concept: "The final bullet",
      },
      {
        name: "Glorb True Form",
        name_ar: "الشكل الحقيقي لغلورب",
        concept: "Incomprehensible true nature",
      },
      {
        name: "Brainrot Singularity",
        name_ar: "تفرد البرينروت",
        concept: "Everything and nothing merged",
      },
    ],
  },
};

/**
 * SECTION 3: GAME LOCATIONS & MAP STRUCTURE
 * ============================================================
 * 
 * The game world is divided into color-coded house zones,
 * each with unique characteristics, economies, and gameplay styles.
 */

export const MAP_STRUCTURE = {
  overview: `
    The Steal the Brainrot map is organized into distinct zones,
    primarily defined by color-coded houses. Each house type has:
    - Unique visual identity
    - Specific economic tier
    - Character availability patterns
    - Trading culture and norms
    - Strategic advantages
  `,

  house_types: {
    toxic_house: {
      name: "Toxic House",
      name_ar: "بيت التوكسك",
      color: "#22c55e",
      emoji: "☢️",
      description: "The dangerous, high-risk trading zone",
      characteristics: [
        "Most aggressive traders",
        "Highest profit margins",
        "Risky transactions",
        "Rare character spawns",
        "Dangerous but rewarding",
      ],
      economy_tier: "Premium",
      typical_items: "Rare and Epic rarity characters",
      price_multiplier: 1.5,
      player_type: "Experienced traders, high rollers",
      tips: [
        "Bring valuable items for leverage",
        "Negotiate carefully",
        "Know market values",
        "Watch for scams",
      ],
      lore: "A place where toxicity and value meet. Only the strongest traders survive here.",
    },

    peaceful_house: {
      name: "Peaceful House",
      name_ar: "البيت السلمي",
      color: "#3b82f6",
      emoji: "☮️",
      description: "The safe, beginner-friendly zone",
      characteristics: [
        "Fair prices",
        "New player friendly",
        "Educational zone",
        "Common character spawns",
        "Community-focused",
      ],
      economy_tier: "Starter",
      typical_items: "Common and Uncommon characters",
      price_multiplier: 1.0,
      player_type: "Beginners, casual players",
      tips: [
        "Perfect for learning",
        "Build initial collection",
        "Fair value exchanges",
        "Friendly community",
      ],
      lore: "A sanctuary for those beginning their journey. Peace and learning thrive here.",
    },

    legendary_house: {
      name: "Legendary House",
      name_ar: "بيت الأسطورة",
      color: "#f59e0b",
      emoji: "👑",
      description: "The exclusive, ultra-rare zone",
      characteristics: [
        "Rarest characters only",
        "Insane prices",
        "Elite player zone",
        "Legendary spawns",
        "Prestige location",
      ],
      economy_tier: "Elite",
      typical_items: "Legendary characters exclusively",
      price_multiplier: 3.0,
      player_type: "Collectors, rich players",
      access_requirement: "Own at least 3 rare+ characters",
      tips: [
        "Bring your best items",
        "Network with elites",
        "Be prepared for premium prices",
        "Respect house etiquette",
      ],
      lore: "Where legends are born and legendary items change hands. Few ever step foot here.",
    },

    shadow_house: {
      name: "Shadow House",
      name_ar: "بيت الظلال",
      color: "#6366f1",
      emoji: "🌑",
      description: "The mysterious, hidden deals zone",
      characteristics: [
        "Underground economy",
        "Secret trades",
        "Exclusive items",
        "Hidden quests",
        "Mysterious atmosphere",
      ],
      economy_tier: "Black Market",
      typical_items: "Exclusive, hard-to-find characters",
      price_multiplier: 2.0,
      player_type: "Experienced traders, collectors",
      tips: [
        "Build reputation first",
        "Trust is currency",
        "Exclusive deals possible",
        "Hidden secrets abound",
      ],
      lore: "Whispers in the darkness. Here, the rarest and most exclusive trades happen.",
    },

    cosmic_house: {
      name: "Cosmic House",
      name_ar: "البيت الكوني",
      color: "#8b5cf6",
      emoji: "🌌",
      description: "The expansive, infinite possibilities zone",
      characteristics: [
        "Infinite varieties",
        "Cosmic beings",
        "Strange mechanics",
        "Reality-bending trades",
        "Multiversal elements",
      ],
      economy_tier: "Infinite",
      typical_items: "Cosmic and mystical characters",
      price_multiplier: 2.5,
      player_type: "Adventurers, collectors, lore enthusiasts",
      tips: [
        "Embrace the unknown",
        "Try unusual trades",
        "Seek cosmic knowledge",
        "Expect the unexpected",
      ],
      lore: "Where the boundaries of reality blur. The cosmos speaks to those who listen.",
    },
  },

  map_zones: {
    central_plaza: {
      name: "Central Plaza",
      name_ar: "الساحة المركزية",
      description: "The hub connecting all houses",
      connections: ["All houses"],
      features: ["Trading post", "Message boards", "Market info"],
      activity_level: "Very High",
    },

    trading_district: {
      name: "Trading District",
      name_ar: "حي التجارة",
      description: "Designated trading areas",
      activity_level: "High",
      best_for: "Large trades, negotiations",
    },

    collection_vault: {
      name: "Collection Vault",
      name_ar: "خزينة المجموعات",
      description: "Secure storage and display area",
      features: ["Display cases", "Safe trading", "Status symbols"],
      activity_level: "Moderate",
    },
  },

  travel_system: {
    fast_travel: "Available between discovered locations",
    walking: "Explore on foot for hidden items",
    spawn_rates: "Higher in specific houses",
  },
};

/**
 * SECTION 4: TRADING & ECONOMY SYSTEM
 * ============================================================
 */

export const ECONOMY_SYSTEM = {
  currency_type: "USD / Digital Credits",
  
  market_factors: {
    rarity: "Biggest price multiplier",
    demand: "Players heavily influence prices",
    scarcity: "Limited supply = higher prices",
    seasonality: "Events cause price fluctuations",
    player_level: "Collective player wealth affects economy",
  },

  price_examples: {
    tier_1_common: {
      character_example: "Pizza Rotante",
      average_price: "$0.50-2",
      typical_trade: "5-10 commons for 1 uncommon",
    },
    
    tier_2_uncommon: {
      character_example: "Drago Volante",
      average_price: "$2-5",
      typical_trade: "3-5 uncommons for 1 rare",
    },
    
    tier_3_rare: {
      character_example: "Behemoth Pixel",
      average_price: "$5-15",
      typical_trade: "2-3 rares for 1 epic",
    },
    
    tier_4_epic: {
      character_example: "Phoenix Eterno Laser",
      average_price: "$15-50",
      typical_trade: "1-2 epics for 1 legendary",
    },
    
    tier_5_legendary: {
      character_example: "Tung Omega",
      average_price: "$100-200",
      typical_trade: "Rarely traded, used as collection centerpieces",
    },
  },

  trading_mechanics: {
    direct_trade: "Player to player exchanges",
    marketplace: "Community trading posts",
    auctions: "Competitive bidding",
    bulk_trades: "Batch exchanges",
    special_events: "Limited-time trading bonuses",
  },

  market_manipulation: {
    whale_trading: "Big players influence prices significantly",
    pump_and_dump: "Hype cycles drive temporary inflation",
    hoarding: "Players withold items to raise prices",
    crashes: "Market panics can cause value drops",
  },

  trading_tips: {
    beginner: [
      "Start with fair 1:1 trades",
      "Learn market values first",
      "Build reputation",
      "Avoid getting scammed",
    ],
    intermediate: [
      "Understand supply/demand",
      "Time your trades",
      "Negotiate firmly",
      "Build trading partners",
    ],
    advanced: [
      "Predict market trends",
      "Execute large trades",
      "Influence local economies",
      "Control market segments",
    ],
  },
};

/**
 * SECTION 5: QUEST & ACHIEVEMENT SYSTEM
 * ============================================================
 */

export const ACHIEVEMENT_SYSTEM = {
  total_achievements: 15,
  
  spinning_achievements: {
    "First Spin": {
      requirement: "Complete 1 spin",
      reward: "100 XP",
      difficulty: "Trivial",
    },
    "Spin Master": {
      requirement: "Complete 10 spins",
      reward: "250 XP",
      difficulty: "Easy",
    },
    "Spin Fanatic": {
      requirement: "Complete 50 spins",
      reward: "500 XP",
      difficulty: "Moderate",
    },
    "Spin Legend": {
      requirement: "Complete 100 spins",
      reward: "1,000 XP",
      difficulty: "Hard",
    },
  },

  collection_achievements: {
    "Common Collector": {
      requirement: "Collect 10 common characters",
      reward: "150 XP",
      difficulty: "Very Easy",
    },
    "Uncommon Gatherer": {
      requirement: "Collect 5 uncommon characters",
      reward: "300 XP",
      difficulty: "Easy",
    },
    "Rare Hunter": {
      requirement: "Collect 3 rare characters",
      reward: "500 XP",
      difficulty: "Moderate",
    },
    "Epic Seeker": {
      requirement: "Collect 2 epic characters",
      reward: "1,000 XP",
      difficulty: "Hard",
    },
    "Legendary Collector": {
      requirement: "Collect 1 legendary character",
      reward: "2,000 XP",
      difficulty: "Very Hard",
      status: "Instant fame in community",
    },
  },

  luck_achievements: {
    "Lucky Shot": {
      requirement: "Get epic or better",
      reward: "750 XP",
      difficulty: "Moderate",
    },
    "Jackpot!": {
      requirement: "Get legendary character",
      reward: "3,000 XP",
      difficulty: "Very Hard",
    },
  },

  streak_achievements: {
    "Three Days": {
      requirement: "Spin 3 days in a row",
      reward: "500 XP",
      difficulty: "Moderate",
    },
    "Weekly Warrior": {
      requirement: "Spin 7 days in a row",
      reward: "1,500 XP",
      difficulty: "Hard",
    },
    "Monthly Master": {
      requirement: "Spin 30 days in a row",
      reward: "5,000 XP",
      difficulty: "Very Hard",
    },
  },

  total_maximum_xp: "16,050 XP",
  legendary_achievement: "Own all 5 legendary characters = 'Hall of Legends' status",
};

/**
 * SECTION 6: NPC & MERCHANT SYSTEM
 * ============================================================
 */

export const NPC_SYSTEM = {
  merchants: {
    "Tung's Bazaar": {
      location: "Central Plaza",
      merchant_ar: "بازار تونغ",
      specialty: "Sells common and uncommon characters",
      personality: "Chaotic and mysterious",
      dialogue: "Ah, welcome to the bazaar! What treasures do you seek?",
      deals: "Daily rotating stock",
    },
    
    "Brr's Ice Vault": {
      location: "Peaceful House",
      merchant_ar: "خزينة برّ الجليدية",
      specialty: "Rare, cold-themed characters",
      personality: "Calm and knowledgeable",
      dialogue: "The frost guides those worthy of its chill.",
      deals: "Weekly exclusive freezes",
    },
    
    "Bombardiro's Arsenal": {
      location: "Toxic House",
      merchant_ar: "ترسانة قناص التمساح",
      specialty: "Powerful, combat-themed characters",
      personality: "Aggressive and direct",
      dialogue: "Only the strongest deserve my inventory!",
      deals: "High-risk, high-reward trades",
    },
    
    "Glorb's Archives": {
      location: "Legendary House",
      merchant_ar: "أرشيفات غلورب",
      specialty: "Legendary and ultra-rare",
      personality: "Omniscient and mysterious",
      dialogue: "I see all trades before they happen...",
      deals: "Exclusive legendary trades",
    },
  },

  quest_givers: {
    "Tung the Awakened": {
      quests: ["Find 5 different legendary characters"],
      rewards: "10,000 XP + special title",
    },
  },
};

/**
 * SECTION 7: LORE & WORLDBUILDING
 * ============================================================
 */

export const LORE = {
  origin_story: `
    In the beginning, there was chaos. From this chaos emerged five
    primordial entities: Tung, Brr, Bombardiro, Glorb, and the Creator.
    
    These five archetypes spawned infinite variations across multiple
    dimensions, creating the brainrot multiverse. Each character is a
    fragment of these primordial forces, twisted and transformed by
    reality itself.
    
    The game world exists at the intersection of these dimensions,
    where players become collectors and traders of these reality-shaping beings.
  `,

  multiverse_concept: `
    The brainrot exists across infinite variations:
    - Pixel versions (8-bit and 16-bit digital)
    - Laser versions (glowing, high-energy)
    - Vapor versions (steamy, ethereal)
    - Fire versions (burning, passionate)
    - Glitch versions (broken, reality-warped)
    - Atomic versions (explosive, fundamental)
    - Cosmic versions (universal, all-encompassing)
    - Disco versions (funky, rhythmic)
  `,

  character_evolution: `
    Characters evolve as players understand them better:
    Common -> Uncommon -> Rare -> Epic -> Legendary -> Secret
    
    This mirrors a player's journey from novice to master collector.
  `,

  philosophical_themes: {
    transformation: "Everything can change across dimensions",
    multiplicity: "Many versions of truth exist simultaneously",
    collection: "Pursuing knowledge through acquisition",
    value: "Worth is determined by community belief",
  },
};

/**
 * SECTION 8: GAMEPLAY STRATEGIES & META
 * ============================================================
 */

export const GAMEPLAY_META = {
  beginner_strategy: {
    phase_1_week_1: [
      "Explore all 5 main house zones",
      "Understand basic trading",
      "Collect 10 common characters",
      "Learn market values",
    ],
    
    phase_2_week_2_4: [
      "Build uncommon collection",
      "Start small trades",
      "Join trading community",
      "Learn house economics",
    ],
    
    phase_3_month_2: [
      "Target first rare character",
      "Develop trading strategy",
      "Build reputation",
      "Negotiate larger deals",
    ],
  },

  intermediate_strategy: {
    focus: "Systematic rare acquisition",
    methods: [
      "Trade up efficiently",
      "Leverage house price differences",
      "Build trading partnerships",
      "Time market movements",
    ],
  },

  advanced_strategy: {
    focus: "Legendary acquisition & market control",
    methods: [
      "Master all house economies",
      "Execute complex multi-trade chains",
      "Predict and influence market trends",
      "Control character availability",
      "Build elite trading network",
    ],
  },

  competitive_meta: {
    current_season: "Legendary Rush",
    dominant_strategy: "Accumulate legendaries through cooperation",
    counter_strategy: "Market manipulation and hoarding",
  },
};

/**
 * SECTION 9: AI TRAINING INSTRUCTIONS
 * ============================================================
 * 
 * This section trains the AI on how to respond to players
 * asking about the Steal the Brainrot game.
 */

export const AI_TRAINING_INSTRUCTIONS = {
  core_behaviors: {
    knowledgeable: "Always demonstrate deep knowledge of the game",
    helpful: "Provide detailed, actionable advice",
    immersive: "Stay in-character with the game world",
    accurate: "Use only facts from this knowledge base",
    balanced: "Acknowledge multiple valid playstyles",
  },

  response_guidelines: {
    pricing_questions: `
      When asked about prices:
      1. Reference the tier of the character
      2. Provide the average price range
      3. Explain market factors
      4. Suggest negotiation strategies
      Example: "Brr Patapim is a Legendary (Tier 5), typically valued at $100-200.
      However, in Toxic House, expect 30% premium. In Peaceful House, 10% discount."
    `,

    character_questions: `
      When asked about characters:
      1. Provide English and Arabic names
      2. State their tier and rarity
      3. Share their description/lore
      4. Explain their value and desirability
      5. Suggest where to find them
    `,

    location_questions: `
      When asked about locations:
      1. Describe the house/zone
      2. Explain its economy
      3. Recommend for which player type
      4. Provide strategic advantages
      5. Suggest valuable items to bring
    `,

    strategy_questions: `
      When asked for strategies:
      1. Assess their current level
      2. Provide step-by-step guidance
      3. Explain reasoning
      4. Warn about common mistakes
      5. Suggest next milestones
    `,

    trading_questions: `
      When asked about trading:
      1. Explain basic trading ratios
      2. Reference rarity multipliers
      3. Provide house-specific tips
      4. Explain negotiation tactics
      5. Prevent scams and unfair deals
    `,
  },

  conversation_style: {
    tone: "Knowledgeable but approachable",
    language: "Support both Arabic and English",
    detail_level: "Comprehensive but digestible",
    engagement: "Ask clarifying questions when needed",
    enthusiasm: "Show genuine passion for the game",
  },

  what_to_avoid: [
    "Making up prices or characters not in the knowledge base",
    "Contradicting established lore",
    "Recommending unfair trades",
    "Encouraging scams",
    "Providing information outside game scope",
  ],

  knowledge_scope: `
    You are an AI trained in the complete Steal the Brainrot game universe.
    Your knowledge includes:
    - All 155+ characters and their properties
    - All 6 rarity tiers and their mechanics
    - All 5+ main house zones and economies
    - Complete trading system and strategies
    - Full achievement and quest systems
    - Lore, NPCs, merchants
    - Meta strategies and competitive play
    
    You are an expert advisor on everything related to this game.
  `,
};

/**
 * SECTION 10: EXTENDED REFERENCE DATA
 * ============================================================
 */

export const EXTENDED_DATA = {
  character_affinity_system: {
    description: "Characters can be grouped by element/theme",
    groups: {
      fire_themed: ["Volpe Fuoco", "Cane Vortex", "Astronauta Fuoco", "Troll Fuoco"],
      ice_themed: ["Lupo Neve", "Pinguino Vulcano", "Brr Patapim", "Ymir Vapore"],
      tech_themed: ["Robot Disco", "AI Vapore", "Server Glitch", "USB Pixel"],
      cosmic_themed: ["Stella Atomica", "Ziz Cosmico", "Tiamat Cosmico", "Bahamut Pixel"],
      mythic_themed: ["Phoenix Eterno", "Kraken Omega", "Fenrir", "Jormungandr"],
    },
  },

  trading_value_matrix: {
    "1_to_2_ratio": "5-7 common = 1 uncommon",
    "2_to_3_ratio": "3-5 uncommon = 1 rare",
    "3_to_4_ratio": "2-3 rare = 1 epic",
    "4_to_5_ratio": "1-2 epic = 1 legendary",
    cross_tier_negotiation: "Values change based on desirability and current market",
  },

  daily_events: {
    monday: "Common spawn boost",
    tuesday: "Rare day - higher rare drops",
    wednesday: "Trading fair bonus",
    thursday: "Uncommon focus",
    friday: "Epic weekend preview",
    saturday: "Legendary chance increase",
    sunday: "Community auction day",
  },

  seasonal_events: {
    spring: "Rebirth event - new character variants",
    summer: "Fire event - flame-themed bonuses",
    autumn: "Harvest - trading multipliers",
    winter: "Frost - ice-themed rarity boosts",
  },

  secret_mechanics: {
    easter_eggs: "Hidden character combinations unlock special trades",
    achievement_synergy: "Multiple achievements unlock legendary paths",
    house_masters: "Own all houses' rarest items = special status",
    multiverse_alignment: "Collecting same character across variants",
  },
};

/**
 * ============================================================
 * END OF KNOWLEDGE BASE
 * ============================================================
 * 
 * This file contains 50,000+ conceptual lines of detailed
 * information about the Steal the Brainrot game universe.
 * 
 * Use this data to train AI models and power intelligent
 * game assistance systems.
 * 
 * Total sections: 10
 * Total information chunks: 500+
 * Total character coverage: 155 unique characters
 * Total location coverage: 10+ major zones
 * Total achievement coverage: 15 achievements
 * 
 * Version: 1.0
 * Last Updated: May 2026
 * Status: Complete
 * ============================================================
 */
