# Interaction Experience Report

## Interaction Principles

- الاهتمام يرفع البطاقة ولا يكبرها بشكل يسبب layout shift.
- تفاصيل الباقة تظهر في سياق المسار ولا توقف تمرير الصفحة.
- hover للمعاينة، click للتثبيت، tap للتثبيت على الجوال.
- السحب الافقي لا يحتسب اختيارا بعد تجاوز 7px.
- كل حركة تعتمد delta time وتخميد حتى تبقى ثابتة بين الشاشات.

## State Matrix

| Component/Area | Default | Hover | Focus | Active | Disabled | Error |
|---|---|---|---|---|---|---|
| Card | يتحرك على القوس | يرتفع حتى 0.55 من الارتفاع ويظهر الخط | المحتوى مكشوف في القائمة الدلالية | click يثبت الرفع واللوحة | غير مستخدم | fallback HTML |
| Category pill | سطح شفاف | لون نص اوضح | ring مرئي | mint filled | غير مستخدم | غير مستخدم |
| Detail panel | مخفي | يظهر بمعاينة | الازرار لها ring | ثابت مع زر اغلاق | غير مستخدم | لا يفتح عند غياب بيانات كاملة |
| CTA | dark pill | يرتفع 2px ويتحول teal | ring mint | ينتقل للنموذج | غير مستخدم | تنقل Next.js المعتاد |

## Loading / Empty / Error / Success States

- Loading: بطاقة shimmer واحدة حتى `document.fonts.ready` وانشاء الخامات.
- Empty: لا ينشأ المشهد اذا كانت قائمة الباقات فارغة.
- Error: عند فشل WebGL او `webglcontextlost` يظهر carousel HTML افقي.
- Success: البطاقة مرفوعة، خط منحني ظاهر، اللوحة تعرض الاسم والسعر والخصم والCTA.

## Motion System

| Motion | Duration | Easing | Trigger | Purpose |
|---|---:|---|---|---|
| Auto travel | مستمر | delta-time linear ثم damp 5 | visibility + عدم reduced motion | حياة مستمرة للمسار |
| Hover lift | 200-500ms حسب المسافة | `MathUtils.damp(..., 5, dt)` | pointer proximity | فصل البطاقة النشطة |
| Connector | نحو 420ms | damp 7 + shader opacity | hover/selection | ربط البطاقة بالمعلومة |
| Panel enter | 420ms | `[0.16,1,0.3,1]` | details become active | ظهور واضح بلا bounce |
| Canvas ready | 700ms | ease-out CSS | WebGL initialized | اخفاء loading بدون flash |

## Keyboard and Mobile Behavior

- الجوال: tap يختار، tap/زر الاغلاق يلغي، swipe افقي يحرك المسار، `touch-action: pan-y` يحافظ على تمرير الصفحة.
- سطح المكتب: hover يعاين، click يثبت، drag يحرك، wheel يدفع المسار قليلا.
- المحتوى الكامل الاساسي موجود في قائمة HTML دلالية خارج Canvas لقارئات الشاشة.
- CTA وزر الاغلاق عناصر HTML فعلية.

## Accessibility Notes

- Canvas `aria-hidden` لانه عرض بصري مكرر لمحتوى HTML.
- `aria-live=polite` على لوحة التفاصيل.
- زر الاغلاق له label عربي واضح.
- التباين داكن على سطح فاتح ويستهدف WCAG AA.
- لا تعتمد المعلومة على اللون فقط؛ الرفع واللوحة والنص تعمل معا.

## Reduced Motion Behavior

- يوقف الحركة الذاتية.
- تبقى استجابة hover/tap الوظيفية بتخميد هادئ.
- يتوقف shimmer animation عبر CSS.
- يبقى fallback النصي متاحا.
