# Higgsfield prompts — "أحدث أعمالنا" showcase images

Constraints (from owner, 2026-07-18):
- Names inside the images: a plausible invented Arabic brand name (never a real existing brand), or no name at all. No AI gibberish names.
- Style: premium "three.js-site" look — floating 3D elements, volumetric glow, depth, award-winning landing design.
- Flat website screenshots — no laptops, no desks, no device lifestyle photos.
- Model: nano_banana (1 credit) or nano_banana_pro (2 credits), aspect 16:9, save to `apps/web/public/projects/*.webp` (max 900px, q82).

## 1. متجر عطور وعود — perfume-store.webp (REGENERATE — current image has a gibberish name)
High-fidelity website screenshot, flat UI, no device frame. Homepage of a luxury Arabic perfume and oud e-commerce store named "دار العود". Right-to-left Arabic layout, dark charcoal background with gold accents. Hero section styled like a three.js WebGL scene: a 3D floating perfume bottle with volumetric golden light, soft smoke and glow, subtle depth of field. Arabic navigation (الرئيسية، المتجر، تواصل معنا), gold button "اطلب الآن", product grid of perfume bottles with prices in Saudi Riyal. Clean legible Arabic typography, award-winning modern web design.

## 2. موقع مطعم وطلبات أونلاين — restaurant.webp
High-fidelity website screenshot, flat UI, no device frame. Homepage of a modern Saudi restaurant ordering website named "مذاق". Right-to-left Arabic layout, warm dark background with amber-orange glow. Hero styled like a three.js scene: 3D floating grilled dish and ingredients with soft shadows and glow, depth of field. Arabic navigation, big button "اطلب الآن", menu cards with dish photos and Riyal prices, delivery time badge. Legible Arabic text, appetizing premium design.

## 3. منصة إدارة مشاريع التخرج — graduation.webp (replace laptop photo with a real screenshot look)
High-fidelity website screenshot, flat UI, no device frame. Dashboard homepage of an Arabic university graduation-projects platform (no brand name shown, just an abstract logo mark). Right-to-left layout, clean light interface with indigo-orange gradient accents. Hero area styled like a three.js scene: floating 3D graduation cap and geometric shapes with soft glow. Sidebar in Arabic, statistics cards, progress charts, list of projects with Arabic titles. Modern SaaS design, crisp legible Arabic labels.

## 4. تطبيق خدمات منزلية — services-app.webp (replaces the inline SVG mockup)
High-fidelity app presentation image, flat design, no hands, no photo background. Two smartphone UI screens of an Arabic home-services booking app (no brand name, abstract logo only) floating over a soft gradient background with 3D glow and depth, three.js style. Right-to-left Arabic UI: first screen service cards (تنظيف، صيانة، نقل) with prices, orange button "احجز الآن"; second screen a live map tracking a technician with an orange route line and status card. Clean legible Arabic text, premium mobile design.

## 5. موقع استشارات هندسية — engineering.webp (replaces the inline SVG mockup)
High-fidelity website screenshot, flat UI, no device frame. Homepage of a Saudi engineering consultancy named "العمران للاستشارات الهندسية". Right-to-left Arabic layout, dark elegant design with orange accents. Hero styled like a three.js WebGL scene: 3D wireframe building model rotating with glowing edges and depth of field. Arabic navigation, button "اطلب استشارة", services cards (تصميم معماري، إشراف هندسي، اعتماد مخططات). Legible Arabic typography, award-winning corporate design.

After generating: download rawUrl, compress to webp (Pillow, thumbnail 900px, quality 82), place in `apps/web/public/projects/`, update `apps/web/src/app/page.tsx` projects data (switch mockup entries to image entries and remove `ProjectMockups.tsx` usage if all replaced), then tsc + build + verify.
