# Interaction Experience Report

## Interaction Principles

- hover لا يفتح التفاصيل ولا يشغل الموصل؛ يمنح البطاقة حركة خفيفة بنسبة 14% فقط.
- ضغطة الماوس اليسار او tap هي المشغل الوحيد للتسلسل الكامل.
- السحب الافقي لا يحتسب اختيارا بعد تجاوز 7px.
- عند الاختيار يتوقف التحرك التلقائي، تخفت البطاقات الاخرى، وترتفع البطاقة المحددة.
- الاشارة تشبه مسار بيانات او طاقة منظم، وليست برق او كهرباء متعرجة.

## State Matrix

| Component/Area | Default | Hover | Focus | Active | Disabled | Error |
|---|---|---|---|---|---|---|
| Card | يتحرك على القوس | ارتفاع خفيف بدون معلومات | المحتوى في القائمة الدلالية | يرتفع ويتوهج وتتوقف الحركة | غير مستخدم | fallback HTML |
| Connector | مخفي | يبقى مخفيا | غير مستخدم | ينطلق عموديا ثم ينعطف اعلى اليسار | غير مستخدم | لا يظهر |
| Detail panel | مخفي | يبقى مخفيا | الازرار لها ring | يتكون بعد وصول الاشارة مع زر اغلاق | غير مستخدم | لا يفتح |
| CTA | dark pill | يرتفع 2px ويتحول teal | ring mint | ينتقل للنموذج | غير مستخدم | تنقل Next.js المعتاد |

## Loading / Empty / Error / Success States

- Loading: بطاقة shimmer حتى تجهيز الخطوط والخامات.
- Empty: لا ينشأ المشهد اذا كانت القائمة فارغة.
- Error: carousel HTML افقي عند فشل WebGL او فقدان السياق.
- Success: البطاقة منفصلة بصريا، الاشارة مكتملة، لوحة الاعلى يسار تعرض المعلومات.

## Motion Choreography

| المرحلة | الزمن التقريبي | التقنية | النتيجة |
|---|---:|---|---|
| Card lock | 0-350ms | `MathUtils.damp` بقوة 7 | ارتفاع، scale خفيف، emissive pulse وتعتيم البقية |
| Source ignition | 0-640ms | 3 حلقات RingGeometry | موجات اطلاق متتابعة من البطاقة |
| Vertical signal | 90-550ms | GLSL ribbon reveal | خط مستقيم يصعد من البطاقة |
| Corner + branch | 450-810ms | piecewise path مع زاوية مستديرة | انعطاف الى الاعلى يسار |
| Data packets | مستمر بعد 180ms | 4 Mesh packets + shader pulses | نقاط طاقة تتحرك داخل المسار |
| Panel shell | 720-1440ms | Framer scaleX/scaleY/blur | بناء سطح اللوحة من نقطة الربط |
| Panel scan | 1080-2230ms | CSS scan line | مسح بصري للوحة |
| Content reveal | 1020-2220ms | staggered Framer Motion | label ثم العنوان والسعر والمزايا والCTA |

## Keyboard and Mobile Behavior

- Desktop: زر الماوس اليسار فقط يختار؛ الزر الايمن لا يشغل شيء. drag يحرك وwheel يدفع المسار.
- Mobile: tap يختار، زر الاغلاق يلغي، وswipe افقي يحرك المسار.
- لوحة الجوال مختصرة حتى لا تصبح تجربة كاملة الشاشة.
- المحتوى الاساسي موجود في قائمة HTML دلالية خارج Canvas.

## Accessibility Notes

- Canvas `aria-hidden` لانه يكرر بيانات HTML.
- `aria-live=polite` على لوحة التفاصيل.
- زر الاغلاق له label عربي واضح.
- المعلومة لا تعتمد على اللون وحده؛ البطاقة ترتفع والبقية تخفت واللوحة تظهر نصيا.

## Reduced Motion Behavior

- يوقف الحركة الذاتية.
- يظهر مسار الاشارة مباشرة بدل التسلسل الطويل.
- تتوقف حلقات الاطلاق وscan وborder pulse.
- يبقى الضغط واللوحة وCTA شغالة.
