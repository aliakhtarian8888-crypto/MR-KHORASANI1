# MR, KHORASANI — poshtiban-Q-baha

## انتقال نسخه 2.11.0 به این شاخه

شاخه `poshtiban-Q-baha` برای نسخه جدید آماده شده است. فایل سورس کامل از ZIP مستقل Android Source دریافت می‌شود؛ این ZIP شامل پروژه Android، وب/PWA، تنظیمات، ماژول‌ها، فایل‌های Supabase و تست‌ها است.

### تنها مرحله دستی لازم برای انتقال سورس

1. فایل `MR-KHORASANI-POSHTIBAN-Q-BAHA-ANDROID-SOURCE-v2.11.0.zip` را از بسته تحویلی دانلود کنید.
2. در همین شاخه، پوشه‌ای با نام `release-staging` بسازید.
3. ZIP را بدون تغییر نام در مسیر زیر بارگذاری کنید:
   `release-staging/MR-KHORASANI-POSHTIBAN-Q-BAHA-ANDROID-SOURCE-v2.11.0.zip`
4. Commit کنید.

Workflow با نام **Import MRK 2.11.0 Poshtiban source archive** فایل را کنترل و روی همین شاخه استخراج می‌کند، سپس Workflow ساخت Android و سه بسته را اجرا و در صورت فعال بودن GitHub Pages، PWA را منتشر می‌کند.

## بسته‌ها و محدودیت پلتفرم

- Web/PWA ZIP: برنامه وب قابل میزبانی HTTPS و نصب از مرورگر.
- Android Source ZIP: سورس کامل Gradle؛ APK تا پایان موفق Workflow ساخته نشده محسوب می‌شود.
- iOS PWA ZIP: نصب از Safari با Add to Home Screen؛ این فایل IPA بومی نیست.
- APK انتشار مشتری نیازمند keystore پایدار است. Debug APK صرفاً برای آزمون داخلی است.
- IPA بومی نیازمند macOS/Xcode و حساب و گواهی Apple Developer است.

## حفاظت داده

- داده‌های واقعی شرکت را برای مهمان یا تست نمونه جایگزین نکنید.
- مهمان فقط از QR وارد نشست کوتاه‌عمر می‌شود؛ عملیات او در دفتر واقعی شرکت ثبت نمی‌شود.
- گزارش سراسری مهمان تنها برای شناسه‌ای که صریحاً در `public.platform_admins` مجاز شده باشد در دسترس است.
- مدیران شرکت به‌صورت خودکار مدیر سامانه محسوب نمی‌شوند.
