# MR, KHORASANI — poshtiban-Q-baha

## انتقال نسخه 2.11.1 به این شاخه

شاخه `poshtiban-Q-baha` برای واردکردن سورس کامل نسخه 2.11.1 آماده شده است. فایل سورس Android Source شامل پروژه Android، وب/PWA، تنظیمات، ماژول‌ها، فایل‌های Supabase و تست‌ها است.

### مرحله بارگذاری سورس

1. فایل `MR-KHORASANI-POSHTIBAN-Q-BAHA-ANDROID-SOURCE-v2.11.1.zip` را دریافت کنید.
2. در همین شاخه، پوشه `release-staging` بسازید.
3. ZIP را بدون تغییر نام در مسیر زیر بارگذاری و commit کنید:
   `release-staging/MR-KHORASANI-POSHTIBAN-Q-BAHA-ANDROID-SOURCE-v2.11.1.zip`
4. Workflow واردکننده فایل را اعتبارسنجی و استخراج می‌کند، سپس Workflow ساخت Android و بسته‌های انتشار را اجرا می‌کند.

## بسته‌ها و محدودیت پلتفرم

- Web/PWA ZIP: برنامه وب قابل میزبانی HTTPS و نصب از مرورگر.
- Android Source ZIP: سورس کامل Gradle؛ APK فقط پس از موفقیت GitHub Actions ساخته‌شده محسوب می‌شود.
- iOS PWA ZIP: نصب از Safari با Add to Home Screen؛ این فایل IPA بومی نیست.
- APK انتشار مشتری نیازمند keystore پایدار است.
- IPA بومی نیازمند macOS/Xcode و حساب و گواهی Apple Developer است.

## حفاظت داده

- داده‌های واقعی شرکت را برای مهمان یا تست نمونه جایگزین نکنید.
- مهمان فقط از QR وارد نشست کوتاه‌عمر می‌شود؛ عملیات او در دفتر واقعی شرکت ثبت نمی‌شود.
- مدیران شرکت به‌صورت خودکار مدیر سامانه محسوب نمی‌شوند.
