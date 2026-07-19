# Visual Design Report

## Visual Concept

**Frosted Kinetic Ribbon**: شريط من بطاقات ثلجية تقنية يتحرك فوق خلفية Opus الحيوية. البطاقة النشطة ترتفع كقطعة مادية وتتصل بلوحة معلومات عبر مسار طاقة مينت-ليموني.

## Aesthetic Direction

تقني سعودي مستقبلي، نظيف وواثق، مع عمق مادي خفيف بدل glassmorphism عام.

## Design Tokens

### Color

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#edf6f4` | الخلفية الاحتياطية |
| `--color-surface` | `#fbfefd` | اللوحة والسطوح |
| `--color-accent` | `#0fc98f` | التفاعل والنقاط |
| `--color-accent-2` | `#0e8aa3` | التصنيف والروابط |
| `--aurora-lime` | `#d9f45f` | الخصم ونهاية الموصل |
| `--color-text` | `#07332e` | النص الاساسي |
| ice | `#e9f8fa` | اجسام البطاقات |

### Typography

| Role | Font/Style | Size/Line Height | Usage |
|---|---|---|---|
| Card name | Cairo 800 | 54px texture | اسم الباقة |
| Card price | Cairo 800 | 86px texture | السعر |
| Panel heading | Cairo 800 | 24-30px / 1.25 | عنوان التفاصيل |
| Body | Cairo 500 | 14px / 28px | الوصف |
| Labels | Cairo 800 | 12px | التصنيف والخصم |

### Spacing

| Token | Value | Usage |
|---|---|---|
| xs | 6px | عناصر مضغوطة |
| sm | 12px | داخل الصفوف |
| md | 20px | padding اللوحة |
| lg | 32px | فصل الكتل |

### Radius / Shadow / Border

| Token | Value | Usage |
|---|---|---|
| Card radius | 0.028 من ارتفاع البطاقة | RoundedBox حقيقي |
| Panel radius | 28px | لوحة التفاصيل |
| Panel border | `1px rgba(255,255,255,.84)` | حافة ثلجية |
| Panel shadow | `0 28px 90px rgba(4,51,44,.14)` | فصل اللوحة |

## Iconography / Illustration

Lucide بخط خفيف داخل اللوحة فقط. لا ايقونات داخل وجه البطاقة حتى يبقى قريب من المرجع.

## Motion Tone

انسياب مستمر وتخميد هادئ بلا bounce. الحركة تخدم تحديد البطاقة واتجاه التفاصيل.

## Anti-patterns to Avoid

- gradients بنفسجي-وردي.
- توهج قوي يخفض قراءة العربية.
- glass cards بلا سماكة او مبرر.
- spring مبالغ فيه.
- ملء الشاشة عند اختيار الباقة.

## Design-DNA Notes

```json
{
  "meta": {
    "name": "Opus Frosted Kinetic Ribbon",
    "description": "مسار باقات ثلاثي الابعاد مستوحى سلوكيا من HUMAIN ONE ومتكيف مع هوية Opus",
    "source_references": ["https://www.humain.com/ar/humain-one", "user screenshot", "Opus package page"],
    "created_at": "2026-07-19"
  },
  "design_system": {
    "color": {
      "palette_type": "analogous",
      "primary": {"hex": "#0fc98f", "role": "interaction and active state"},
      "secondary": {"hex": "#0e8aa3", "role": "labels and links"},
      "accent": {"hex": "#d9f45f", "role": "discount and connector endpoint"},
      "neutral": {"scale": ["#fbfefd", "#edf6f4", "#d2e7e1", "#517069", "#07332e"], "usage": "frosted surfaces and dark text"},
      "semantic": {"success": "#0fc98f", "warning": "#d9f45f", "error": "#d94f5f", "info": "#0e8aa3"},
      "surface": {"background": "#edf6f4", "card": "#fbfefd", "elevated": "rgba(248,253,251,.78)"},
      "contrast_strategy": "dark-on-light with translucent surfaces"
    },
    "typography": {
      "type_scale": {
        "display": {"size": "60px", "weight": 800, "line_height": 1.1, "tracking": "-0.02em"},
        "heading_1": {"size": "48px", "weight": 800, "line_height": 1.15, "tracking": "-0.015em"},
        "heading_2": {"size": "36px", "weight": 800, "line_height": 1.2, "tracking": "-0.01em"},
        "heading_3": {"size": "28px", "weight": 800, "line_height": 1.25, "tracking": "0"},
        "body": {"size": "16px", "weight": 500, "line_height": 1.8, "tracking": "0"},
        "body_small": {"size": "14px", "weight": 500, "line_height": 1.7, "tracking": "0"},
        "caption": {"size": "12px", "weight": 700, "line_height": 1.5, "tracking": "0"},
        "overline": {"size": "11px", "weight": 800, "line_height": 1.4, "tracking": "0.04em"}
      },
      "font_families": {"heading": "Cairo", "body": "Cairo", "mono": "ui-monospace"},
      "font_style_notes": "Arabic geometric sans, heavy headings and calm body"
    },
    "spacing": {"base_unit": "4px", "scale": ["4px", "8px", "12px", "20px", "32px", "48px"], "content_density": "comfortable", "section_rhythm": "wide canvas with compact floating panel"},
    "layout": {"grid_system": "12-column page plus full-bleed canvas", "max_content_width": "1280px", "columns": 12, "gutter": "24px", "breakpoints": ["640px", "720px", "1024px", "1200px"], "alignment_tendency": "centered canvas with asymmetric active panel"},
    "shape": {"border_radius": {"small": "12px", "medium": "20px", "large": "28px", "pill": "999px"}, "border_usage": "subtle 1px white borders", "divider_style": "dark green at 10 percent opacity"},
    "elevation": {"shadow_style": "soft diffused", "levels": {"low": "0 8px 24px rgba(4,51,44,.08)", "medium": "0 20px 60px rgba(4,51,44,.12)", "high": "0 28px 90px rgba(4,51,44,.14)"}, "depth_cues": "true geometry, overlap, z lift, blur and shadow"},
    "iconography": {"style": "rounded outline", "stroke_weight": "1.75-2", "size_scale": ["14px", "16px", "20px"], "preferred_set": "Lucide"},
    "motion": {"easing": "exponential damping and cubic-bezier(0.16,1,0.3,1)", "duration_scale": {"micro": "180ms", "normal": "420ms", "macro": "700ms"}, "entrance_pattern": "fade, small rise and blur clear", "exit_pattern": "short fade and settle", "philosophy": "continuous cinematic but functional"},
    "components": {"button_style": "dark pill CTA", "input_style": "unchanged", "card_style": "rounded 3D frosted slab", "navigation_pattern": "existing site nav", "modal_style": "none; contextual floating panel", "list_style": "compact check rows", "component_notes": "canvas owns geometry, DOM owns readable details"}
  },
  "design_style": {
    "aesthetic": {"mood": ["future-facing", "clean", "confident", "fluid"], "visual_metaphor": "a living catalog ribbon", "era_influence": "contemporary AI enterprise", "genre": "premium digital studio", "personality_traits": ["precise", "approachable", "technical"], "adjectives": ["icy", "kinetic", "luminous"]},
    "visual_language": {"complexity": "rich focal interaction", "ornamentation": "subtle accents", "whitespace_usage": "open around dense ribbon", "visual_weight_distribution": "heavy center card and side panel", "focal_strategy": "single lifted card", "contrast_level": "medium-high", "texture_usage": "frosted gradients and PBR highlights"},
    "composition": {"hierarchy_method": "depth, lift and scale", "balance_type": "dynamic asymmetric", "flow_direction": "horizontal ribbon then diagonal connector", "grouping_strategy": "overlapping repeated cards", "negative_space_role": "space for lift and panel"},
    "imagery": {"photo_treatment": "none", "illustration_style": "real-time 3D product display", "graphic_elements": "energy ribbon and dots", "pattern_usage": "repetition", "image_shape": "tall rounded slab"},
    "interaction_feel": {"feedback_style": "staged signal launch", "hover_behavior": "subtle 14 percent response without details", "transition_personality": "cinematic multi-stage", "loading_style": "frosted shimmer card", "microinteraction_density": "focused but high-impact"},
    "brand_voice_in_ui": {"tone": "واضح وواثق", "formality": "مهني قريب", "cta_style": "direct imperative", "empty_state_approach": "helpful", "error_tone": "plain and recoverable"}
  },
  "visual_effects": {
    "overview": {"effect_intensity": "heavy-immersive", "performance_tier": "heavy", "fallback_strategy": "HTML horizontal cards and paused auto motion", "primary_technology": "WebGL/Three.js"},
    "background_effects": {"type": "video-bg", "description": "optimized HUMAIN-like flowing color field already in Opus", "technology": "HTML video", "params": {"color_palette": ["mint", "teal", "lime"], "speed": "slow", "density": "full viewport", "opacity": 1, "blend_mode": "normal"}},
    "particle_systems": {"enabled": false, "type": "none", "description": "not needed", "technology": "none", "params": {"count": 0, "shape": "none", "size_range": "none", "movement_pattern": "none", "color_behavior": "none", "interaction": "none", "spawn_area": "none"}},
    "3d_elements": {"enabled": true, "type": "product-carousel and signal launch", "description": "64 rounded slabs plus click-triggered rings, data packets and endpoint reticle", "technology": "Three.js", "params": {"renderer": "WebGLRenderer alpha antialias", "lighting": "hemisphere plus two directional lights", "camera": "orthographic for stable responsive sizing", "materials": "MeshPhysicalMaterial, CanvasTexture and additive MeshBasicMaterial", "geometry": "shared RoundedBoxGeometry, ribbon, rings and packets", "post_processing": [], "interaction_model": "subtle hover; left-click/tap launch; horizontal drag"}},
    "shader_effects": {"enabled": true, "type": "custom signal ribbon", "description": "mint-to-lime line rising vertically then bending toward the top-left panel", "technology": "GLSL ShaderMaterial", "params": {"uniforms": ["uOpacity", "uProgress", "uTime", "uMint", "uLime"], "vertex_manipulation": "CPU-updated piecewise straight path with rounded corner", "fragment_output": "progressive additive core, moving packets and launch head", "noise_type": "none", "distortion": "none"}},
    "scroll_effects": {"parallax": {"enabled": false, "layers": 0, "depth_range": "none", "speed_curve": "none"}, "scroll_triggered_animations": {"enabled": false, "trigger_points": [], "animation_type": "none", "scrub_behavior": "none"}, "scroll_morphing": {"enabled": false, "description": "none"}},
    "text_effects": {"type": "none", "description": "text stays crisp", "technology": "Canvas2D and DOM", "params": {"split_strategy": "none", "animation_per_unit": "none", "stagger": 0, "effect_style": "none"}},
    "cursor_effects": {"enabled": true, "type": "existing custom cursor", "description": "site cursor recognizes canvas", "params": {"shape": "site default", "size": "site default", "blend_mode": "normal", "trail": false, "interaction_zone": "package canvas"}},
    "image_effects": {"type": "none", "description": "no raster package images", "technology": "none", "params": {"filter_pipeline": [], "hover_transform": "none", "reveal_animation": "none", "distortion_type": "none"}},
    "glassmorphism_neumorphism": {"enabled": true, "style": "frosted-layers", "params": {"blur_radius": "24px", "transparency": 0.78, "border_treatment": "1px white 84 percent", "shadow_type": "soft diffused", "light_source_angle": "top-left"}},
    "canvas_drawings": {"enabled": true, "type": "interactive product ribbon", "description": "real-time cards and click-launched signal system", "technology": "WebGL", "params": {"draw_method": "requestAnimationFrame", "animation_loop": "visibility-aware", "color_scheme": "mint teal lime", "responsiveness": "ResizeObserver", "interaction": "left-click tap drag wheel; hover remains subtle"}},
    "svg_animations": {"enabled": false, "type": "none", "description": "none", "params": {"animation_method": "none", "path_morphing": false, "stroke_animation": false, "filter_effects": []}},
    "composite_notes": "The visual depth comes from real rounded geometry, overlapping z order, a video backdrop, and one custom connector shader. No bloom or composer is used to protect performance."
  }
}
```
