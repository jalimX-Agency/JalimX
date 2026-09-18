# JalimX

موقع ونظام JalimX.
الخطة: [PLAN.md](PLAN.md) · الهوية: [../brand/BRAND.md](../brand/BRAND.md) · الإعداد: [docs/SETUP.md](docs/SETUP.md)

## البنية

```
website/
├── frontend/     Next.js 16 · TypeScript · Tailwind 4
└── backend/      Laravel 12 · headless API · PostgreSQL
```

**مشروعان مستقلان**، كل واحد بالحزم ديالو ونشره الخاص. الرابط الوحيد بيناتهم هو
الـ API — والأنواع مولّدة منه تلقائياً، ماشي مكتوبة باليد.

## التشغيل

خاص **جوج ترمينالات**:

```bash
# 1 — الباك إند  →  http://127.0.0.1:8000
cd backend && php artisan serve
```

```bash
# 2 — الفرونت إند  →  http://localhost:3200
cd frontend && pnpm dev
```

## الأوامر

### frontend

| الأمر | الوظيفة |
|---|---|
| `pnpm dev` | سيرفر التطوير (منفذ 3200) |
| `pnpm build` | بناء الإنتاج |
| `pnpm typecheck` | فحص الأنواع |
| `pnpm lint` | ESLint |
| `pnpm api:types` | **يولّد أنواع TS من الـ API** (خاص الباك يكون خدّام) |
| `pnpm capture:work` | يصوّر مواقع العملاء الحية لقسم الأعمال |
| `pnpm shot` | يصوّر صفحاتنا كاملة للمراجعة (`-- /work /about`) |

### backend

| الأمر | الوظيفة |
|---|---|
| `php artisan serve` | سيرفر التطوير (منفذ 8000) |
| `php artisan migrate` | تشغيل الـ migrations |
| `php artisan route:list` | لائحة المسارات |
| `php artisan test` | الاختبارات |

## عقد الأنواع

```
Laravel  →  /docs/api.json (Scramble)  →  openapi-typescript  →  frontend/lib/api/schema.d.ts
```

منين تبدل حقل فـ Laravel: شغّل `pnpm api:types` فالفرونت. إلا نسيتي، `pnpm typecheck`
كايطيح. **هادا هو الشي الوحيد اللي كايمنع الفرونت والباك من الانفصال بصمت** — خليه فالـ CI.

> ⚠️ `schema.d.ts` مولّد — ماكايتعدلش باليد، ولكن **كايتكوميتا فـ git**: Vercel كايبني الفرونت بلا ما يشوف الباك (حتى إلا كان الباك ديال الإنتاج تايخدم)، فخاصو يلقا الأنواع جاهزة فالريبو. بعد `pnpm api:types`، دير `git add` للملف مع الـ commit.

## نقاط النهاية

| المسار | الوصف |
|---|---|
| `GET /api/v1/health` | فحص الحياة |
| `GET /api/v1/auth/me` | المستخدم الحالي (يتطلب Sanctum) |
| `GET /docs/api` | وثائق الـ API (واجهة) |
| `GET /docs/api.json` | مواصفة OpenAPI |

## المسارات

كل مسار موجود بلغتين: الإنجليزية فالجذر، الفرنسية بـ `/fr`.

| | |
|---|---|
| `/` · `/fr` | الرئيسية — hero · خدمات · أعمال · طريقة العمل |
| `/work` · `/work/[slug]` | الأعمال و case studies |
| `/development` | الخدمة الرئيسية بعمق تقني (MACHINED) |
| `/about` | الطريقة |
| `/contact` | فورم كايكتب فـ `leads` |
| `/design-system` | مرجع داخلي (noindex، إنجليزية فقط) |

**نصوص الواجهة** فـ `messages/{en,fr}.json`.
**المحتوى** (خدمات، أعمال، إعدادات) كايجي من الـ API بلغتين.

## الحالة

- [x] **M0** التأسيس · **M2** الـ API · Neon متصل
- [x] **M4** الموقع العمومي — 6 مسارات × لغتين، فورم شغّال، sitemap بـ hreflang
- [x] `/development` — 5 أقسام تقنية بلغتين
- [ ] **M3** الداشبورد
- [ ] الدومين + النشر

> ⚠️ قيس الأداء على `pnpm build && pnpm start`. فالتطوير أول زيارة لمسار فيه
> صور كتوصل دقائق (كومبايل على البارد)؛ فالإنتاج نفس المسار كايجاوب فـ 10ms.
