# UI Form and Layout Report

## Interface Type

Landing page commerce section داخل صفحة باقات عامة.

## Page Inventory

| Page | Purpose | Key Components | Priority |
|---|---|---|---|
| `/packages` | عرض باقات المشاريع وتحويل الزائر الى طلب | عنوان، فلاتر، مشهد بطاقات، لوحة تفاصيل، CTA | P0 |
| `/project-request` | استقبال طلب المشروع | النموذج الحالي | P0 بدون تغيير |

## Layout Paradigm

- عنوان الصفحة فوق القسم.
- فلاتر pills في صف قابل للسحب على الجوال.
- Canvas بعرض viewport بالكامل داخل محتوى مقيد.
- بطاقات طويلة متداخلة على قوس تربيعي.
- لوحة التفاصيل absolute داخل المشهد، يمين او يسار على سطح المكتب، وعرض شبه كامل اعلى الجوال.
- التعليمات وCTA المخصص اسفل المشهد.

## Navigation Model

لا تغيير في تنقل الموقع. المسار هو `/packages` ثم CTA الى `/project-request`.

## Component Strategy

- `PackageOrbitScene`: مسؤول حصريا عن WebGL والحركة والاختيار والخط.
- `PackagesSection`: مصدر البيانات وحالة hover/selection ولوحة HTML.
- `globals.css`: النسب والاستجابة وسطح اللوحة فقط.
- حذف `PackageDetailsModal` لان السلوك الكامل الشاشة مرفوض.

## Responsive Strategy

| Breakpoint | Layout Behavior | Notes |
|---|---|---|
| `<720px` | مشهد 125vw بحد 500-620px، بطاقة مركزية، لوحة بعرض المحتوى اعلى المشهد | tap للتثبيت، اخفاء الوصف والمزايا داخل اللوحة لضبط الارتفاع |
| `720-1199px` | مشهد 2.3:1، لوحة جانبية 390px | hover وclick وسحب |
| `>=1200px` | بطاقات حتى 220px عرضا ومساحة كاملة | كثافة قريبة من المرجع |

## Density and Scanning Model

الوجه منخفض الكثافة: تصنيف صغير، اسم كبير، سعر كبير. التفاصيل المتوسطة الكثافة تنتقل للوحة. التداخل يجعل المسار غنيا بصريا لكن البطاقة النشطة تنفصل بوضوح عبر الرفع والعمق.

## Trade-offs

- DOM panel افضل من نص WebGL للتحديد والوصول.
- Orthographic camera تحافظ على تطابق القياسات واستقرار العربية، بينما RoundedBox والاضاءة تمنح العمق المطلوب.
- لا post-processing للحفاظ على الاداء.
