# UI Design Spec — Opus Package Orbit

> ناتج الوضع العميق، ومبني على تحليل مباشر لصفحة HUMAIN ONE وصورة المستخدم وكود Opus الحالي.

## 1. Product and User Context

قسم باقات Opus يخدم الطلاب واصحاب الافكار والاعمال الذين يريدون مقارنة نوع المشروع وسعر البداية بسرعة. الهدف تحويل الاستكشاف الى طلب مشروع بدون شبكة اسعار تقليدية وبدون Modal يقطع سياق الصفحة.

## 2. Design Goals

1. تطابق سلوكي دقيق مع مسار بطاقات HUMAIN: 64 بطاقة، تداخل، قوس، حركة مستمرة، ورفع سلس.
2. الحفاظ على محتوى Opus: اسم الباقة والسعر في الوجه، والتفاصيل في لوحة سياقية.
3. اظهار العمق عبر هندسة Three.js حقيقية وخامة PBR.
4. اشارة Three.js تطلع عموديا من البطاقة ثم تنعطف الى لوحة ثابتة اعلى اليسار.
5. التفاصيل تعمل بضغطة اليسار او tap فقط؛ hover يبقى استجابة خفيفة بدون معلومات.

## 3. Reference and Skill Sources

### References

- [HUMAIN ONE](https://www.humain.com/ar/humain-one) — العنصر `c145-agent-selector`.
- صورة المستخدم `pi-clipboard-494e544c-d4d1-405d-af25-cfcdb98b995e.png`.
- نظام الوان وخلفية Opus الحالي.

### External Skills Consulted

| Skill | Available? | Influence |
|---|---:|---|
| ui-workflow | نعم | الوضع العميق والمخرجات والمراجعة |
| frontend-design | نعم | اتجاه بصري واحد وتنفيذ غير عام |
| design-dna | نعم | tokens والشكل ومؤثرات WebGL |
| web-browser | نعم | تحليل DOM وShadow DOM وCanvas الحي |
| bundled analysts | تعذر ليلا | استخدم fallback اليدوي المسموح ولم يتوقف التنفيذ |

## 4. Page and Flow Overview

```text
/packages
  → اختيار تصنيف اختياري
  → left-click او tap على بطاقة
  → ارتفاع البطاقة وحلقات الاطلاق
  → اشارة عمودية ثم فرع الى اعلى اليسار
  → بناء لوحة التفاصيل على مراحل
  → ابدأ مشروعك
  → /project-request
```

## 5. Information Architecture

- بطاقة: التصنيف، الاسم، السعر، السعر السابق.
- لوحة: التصنيف، الاسم، السعر، الخصم، وصف مختصر، اول ثلاث مزايا، CTA.
- قائمة دلالية: الاسم والوصف والسعر لكل الباقات خارج Canvas.
- لا بحث ولا فرز لان الخيارات خمسة.

## 6. Layout and Component System

- `PackageOrbitScene.tsx`: WebGL renderer، 64 بطاقة، الحركة، hit testing، السحب، الموصل.
- `PackagesSection.tsx`: الفلاتر، selection state، لوحة التفاصيل متعددة المراحل، CTA.
- `globals.css`: نسبة المشهد، panel surface، استجابة الجوال.
- Desktop canvas: نسبة 2.3:1.
- Mobile canvas: ارتفاع 145vw بحد 560-650px حتى تبقى الاشارة ظاهرة بين البطاقة واللوحة.
- Panel: 390px اعلى اليسار على desktop، و12px inset على mobile.

## 7. Visual System

### Colors

- Background `#edf6f4`
- Surface `#fbfefd`
- Mint `#0fc98f`
- Teal `#0e8aa3`
- Lime `#d9f45f`
- Text `#07332e`
- Card washes: `#e7faf4`, `#e9f8fa`, `#f6fbdc`, `#e8f9f5`, `#edf9fb`

### Typography

Cairo للواجهة وCanvas. اسم البطاقة 54px texture، السعر 86px، عنوان اللوحة 24-30px، والنص 14px.

### Spacing

قاعدة 4px، مع 12px للعناصر الصغيرة، 20px داخل اللوحة، و32px بين الكتل الكبيرة.

### Radius / Shadow / Border

- البطاقة RoundedBox بنسبة radius 0.028 من ارتفاعها وسماكة 0.04.
- اللوحة radius 28px، border ابيض شفاف، blur 24px، shadow واسع خفيف.

### Iconography / Illustration

Lucide داخل لوحة HTML فقط. البطاقة تبقى نصية مثل المرجع.

## 8. Interaction System

### Component States

- Default: يتحرك المسار تلقائيا.
- Hover: استجابة خفيفة بنسبة 14% بدون خط او لوحة.
- Selected: ضغطة اليسار او tap توقف المسار، ترفع البطاقة، تخفت البقية، وتطلق تسلسل الاشارة واللوحة.
- Drag: بعد 7px يلغى click ويتحرك المسار.
- Filtered: opacity 0.42 لغير المطابق.
- Error: HTML horizontal fallback.

### Loading / Empty / Error / Success

- shimmer card اثناء التهيئة.
- لا مشهد عند قائمة فارغة.
- fallback عند فشل WebGL او فقدان context.
- نجاح الاختيار يظهر 3 حلقات اطلاق، خط صاعد، زاوية وفرع، 4 نبضات بيانات، reticle، ثم اللوحة.

### Motion

- تباعد: `0.30 × cardHeight`.
- قوس: `y = baseline - 0.1 × x² / cardHeight`.
- سرعة تلقائية مكافئة للمرجع: `stride × 0.64 / second`.
- hover damping بقوة 5، والاختيار بقوة 7.
- الاشارة تبدأ بعد 90ms وتكتمل خلال نحو 810ms عبر `uProgress`.
- حلقات الاطلاق متعاقبة خلال 640ms، ونبضات البيانات تستمر داخل الخط.
- Panel shell يبدأ عند 720ms، ثم scan ومحتوى staggered حتى نحو 2.2 ثانية.
- Panel easing: `[0.16, 1, 0.3, 1]`.

### Accessibility

- Canvas زخرفي ومخفي عن قارئ الشاشة.
- بيانات الباقات مكررة في قائمة HTML دلالية.
- CTA وزر الاغلاق HTML فعليان.
- `aria-live=polite` للوحة.
- reduced motion يوقف الحركة الذاتية.

## 9. Content and Copy System

- لهجة سعودية واضحة.
- اسم + سعر في البطاقة.
- `اضغط على البطاقة لاطلاق التفاصيل`.
- CTA: `ابدأ مشروعك`.
- بديل: `أو اطلب عرض مخصص`.

## 10. Responsive Behavior

- Mobile: tap فقط، لوحة مختصرة، وخط عمودي ظاهر اسفلها داخل مشهد اطول.
- Tablet/Desktop: hover خفيف فقط، ضغطة اليسار تطلق الاشارة، واللوحة ثابتة اعلى اليسار.
- Wide: عرض البطاقة لا يتجاوز 220px للحفاظ على كثافة المرجع.

## 11. Implementation Notes

- Shared `RoundedBoxGeometry` و`PlaneGeometry`، وخامات منفصلة للحالات.
- `ResizeObserver` يعيد ضبط renderer والكاميرا والقياسات.
- pixel ratio محدود الى 1.55 desktop و1.2 coarse.
- الرسم يتوقف عند خروج القسم من viewport او اخفاء التبويب.
- موصل ribbon ثابت الهندسة ويحدث buffer فقط، بمسار عمودي ثم زاوية مستديرة وفرع افقي.
- Shader uniforms: `uProgress`, `uTime`, `uOpacity` مع core وhead وpackets.
- حلقات الاطلاق والنبضات Meshes يعاد استخدامها بدون انشاء موارد كل frame.
- لا EffectComposer ولا bloom.
- الموارد كلها dispose عند unmount.

## 12. Risks, Assumptions, and Follow-ups

- 64 بطاقة بخامة Physical مقبول حاليا؛ اذا ظهر ضعف على اجهزة قديمة يمكن تحويل الاجسام الى InstancedMesh في تحسين لاحق.
- التطابق مع HUMAIN مبني على السلوك والقياسات المرصودة، لا نسخ الكود او الهوية.
- اسعار ومحتوى الباقات الحالية اعتبرت المصدر الصحيح.
- analytics للتفاعل خارج نطاق هذا التعديل.

## 13. Prototype Recommendation

لا حاجة لملف HTML منفصل لان النموذج عالي الدقة تم تنفيذه مباشرة داخل تطبيق Next.js واختباره على desktop وmobile.
