# Information Architecture Report

## Navigation Model

لا تغيير في التنقل العام. قسم الباقات يعمل كطبقة استكشاف داخل `/packages` وينتهي الى `/project-request`.

## Route / Page Hierarchy

```text
/
├── packages
│   ├── category filters
│   ├── WebGL package ribbon
│   ├── contextual package detail panel
│   └── custom quote link
└── project-request
    └── existing project request flow
```

## Information Groups

1. **التوجيه:** عنوان الصفحة ووعد الاسعار الواضحة.
2. **التضييق:** فلاتر انواع المشاريع.
3. **الاستكشاف:** اسم وسعر كل باقة داخل البطاقة.
4. **التفاصيل السياقية:** الوصف، الخصم، ثلاث مزايا، CTA.
5. **الثقة:** ما تتضمنه الباقات والتفاصيل المهمة اسفل القسم.

## Search / Filter / Sort Model

- لا حاجة للبحث او الفرز لان الخيارات خمسة فقط.
- الفلتر لا يحذف البطاقات من المسار؛ يخفض opacity لغير المطابق حتى لا ينكسر الشريط المستمر.
- خيار `الكل` يعيد التركيز المتساوي.

## Cross-page User Flows

```text
/packages → hover/tap card → contextual details → ابدأ مشروعك → /project-request
/packages → filter category → inspect matching package → /project-request
/packages → اطلب عرض مخصص → /project-request
```

## Scalability Notes

- البيانات الحالية في مصفوفة `packages` وتكرر دوريا حتى 64 نسخة.
- اضافة باقة جديدة لا تتطلب تغيير خوارزمية الحركة.
- عند تجاوز 8-10 باقات يفضل نقل البيانات الى ملف catalog مركزي، لكنه خارج نطاق الطلب الحالي.

## Risks and Simplification Options

- لا تحول اللوحة الى صفحة تفاصيل مستقلة الا اذا زاد محتواها بشكل كبير.
- لا تضف nested categories او search قبل زيادة عدد الباقات.
- البديل الابسط عند ضعف WebGL هو المسار HTML الموجود، وليس اخفاء القسم.
