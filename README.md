# تیم‌کشی — یارکشی زنده و امتیازدهی تیم‌ها در بوت‌کمپ

اپ فارسی برای یارکشی زنده روی پرده، امتیازدهی داورها با گوشی، رده‌بندی زنده و اعلام نتیجه. به‌صورت پیش‌فرض آنلاین کار می‌کند و برای قطعی اینترنت هم آماده است.

## اجرا

| هدف | دستور |
|---|---|
| توسعه | `npm install` و بعد `npm run dev` |
| تست‌ها | `npm test` |
| بیلد اپ + سرور لپ‌تاپ | `npm run build:all` |
| حالت بدون اینترنت روی لپ‌تاپ | `start-offline.bat` (ویندوز) یا `start-offline.command` (مک) |

## ساختار

- `src/`: اپ React (یارکشی، امتیازدهی، استیج)
  - `src/store/`: state و reducer خالص
  - `src/sync/`: همگام‌سازی آفلاین‌محور (صف امتیازها، ادغام بر اساس جدیدترین تغییر)
- `api/sync.ts`: API آنلاین روی Vercel با دیتابیس Neon Postgres
- `server/`:
  - `core.ts`: منطق مشترک API
  - `store-postgres.ts`: ذخیره در Postgres/Neon
  - `store-file.ts`: ذخیره در فایل
  - `server.ts`: سرور Node برای لپ‌تاپ یا VPS
- `public/sw.js`: کش آفلاین (PWA)

## راه‌اندازی و روز رویداد

راه‌اندازی روی Vercel + Neon، آمادگی قبل از رویداد، و رفتن به حالت لپ‌تاپ:
[`docs/sync-and-offline.md`](docs/sync-and-offline.md)
