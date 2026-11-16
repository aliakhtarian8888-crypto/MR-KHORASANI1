package com.mrkhorasani.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import android.util.Base64;

public final class MainActivity extends Activity {
    private static final int REQUEST_CREATE_DOCUMENT = 4101;
    private static final int REQUEST_OPEN_DOCUMENT = 4102;
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";

    private WebView webView;
    private byte[] pendingExportBytes;
    private String pendingExportRequestId;
    private String pendingExportFileName;
    private ValueCallback<Uri[]> pendingFileChooser;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && APP_ASSET_HOST.equalsIgnoreCase(uri.getHost())) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && APP_ASSET_HOST.equalsIgnoreCase(uri.getHost())) return false;
                openExternal(uri);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = callback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] acceptedMimeTypes = acceptedMimeTypes(params == null ? null : params.getAcceptTypes());
                if (acceptedMimeTypes.length > 0) {
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptedMimeTypes);
                }
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                        params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try {
                    startActivityForResult(intent, REQUEST_OPEN_DOCUMENT);
                    return true;
                } catch (ActivityNotFoundException error) {
                    pendingFileChooser = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "انتخاب‌گر فایل در دسترس نیست", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new NativeExportBridge(), "AndroidBridge");
        webView.loadUrl("https://" + APP_ASSET_HOST + "/assets/index.html?mrk_android=1");
    }

    private String[] acceptedMimeTypes(@Nullable String[] acceptedTypes) {
        Set<String> types = new LinkedHashSet<>();
        if (acceptedTypes != null) {
            for (String raw : acceptedTypes) {
                if (raw == null) continue;
                for (String item : raw.split(",")) {
                    String type = item.trim().toLowerCase(Locale.ROOT);
                    if (type.startsWith(".")) {
                        if (type.equals(".xlsx")) types.add("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                        else if (type.equals(".csv")) types.add("text/csv");
                        else if (type.equals(".tsv")) types.add("text/tab-separated-values");
                        else if (type.equals(".txt")) types.add("text/plain");
                    } else if (type.contains("/") && !type.equals("*/*")) {
                        types.add(type);
                    }
                }
            }
        }
        if (types.isEmpty()) {
            types.add("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            types.add("text/csv");
            types.add("text/tab-separated-values");
            types.add("text/plain");
        }
        return types.toArray(new String[0]);
    }

    private void openExternal(Uri uri) {
        if (uri == null || uri.getScheme() == null) return;
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("mailto") && !scheme.equals("tel")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "برنامه‌ای برای باز کردن این پیوند پیدا نشد", Toast.LENGTH_SHORT).show();
        }
    }

    private final class NativeExportBridge {
        @JavascriptInterface
        public boolean isNativeApp() { return true; }

        @JavascriptInterface
        public void saveFile(String requestId, String fileName, String mimeType, String base64Data) {
            if (pendingExportBytes != null) {
                notifyNativeFileResult(requestId, false, "یک ذخیره‌سازی دیگر هنوز در حال انجام است.");
                return;
            }
            try {
                pendingExportBytes = Base64.decode(base64Data, Base64.DEFAULT);
                pendingExportRequestId = requestId;
                pendingExportFileName = safeFileName(fileName);
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType == null || mimeType.isEmpty()
                            ? "application/octet-stream" : mimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingExportFileName);
                    intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                            | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivityForResult(intent, REQUEST_CREATE_DOCUMENT);
                    } catch (ActivityNotFoundException error) {
                        finishPendingExport(false, "ذخیره‌ساز فایل در دسترس نیست.");
                    }
                });
            } catch (IllegalArgumentException error) {
                pendingExportBytes = null;
                pendingExportRequestId = null;
                pendingExportFileName = null;
                notifyNativeFileResult(requestId, false, "داده فایل خروجی قابل خواندن نیست.");
            }
        }
    }

    private void notifyNativeFileResult(String requestId, boolean success, String message) {
        if (webView == null || requestId == null) return;
        String script = "if(window.MRKNativeFileResult){window.MRKNativeFileResult("
                + JSONObject.quote(requestId) + "," + success + ","
                + JSONObject.quote(message == null ? "" : message) + ");}";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void finishPendingExport(boolean success, String message) {
        String requestId = pendingExportRequestId;
        pendingExportBytes = null;
        pendingExportRequestId = null;
        pendingExportFileName = null;
        notifyNativeFileResult(requestId, success, message);
    }

    private String safeFileName(String value) {
        if (value == null || value.trim().isEmpty()) return "MR-KHORASANI-export.xlsx";
        String cleaned = value.replaceAll("[\\\\/:*?\"<>|]", "-")
                .replaceAll("[\\p{Cntrl}]", "")
                .trim();
        return cleaned.isEmpty() ? "MR-KHORASANI-export.xlsx" : cleaned;
    }

    private Uri[] selectedUris(@Nullable Intent data) {
        if (data == null) return null;
        List<Uri> selected = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri uri = clip.getItemAt(i).getUri();
                if (uri != null) selected.add(uri);
            }
        } else if (data.getData() != null) {
            selected.add(data.getData());
        }
        for (Uri uri : selected) {
            try {
                getContentResolver().takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // Some document providers return temporary grants only; WebView can still read during this selection.
            }
        }
        return selected.isEmpty() ? null : selected.toArray(new Uri[0]);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CREATE_DOCUMENT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingExportBytes != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (output == null) throw new IllegalStateException("Output stream unavailable");
                    output.write(pendingExportBytes);
                    output.flush();
                    finishPendingExport(true, "فایل در مسیر انتخاب‌شده ذخیره شد.");
                } catch (Exception error) {
                    finishPendingExport(false, "ذخیره فایل ناموفق بود: " + error.getMessage());
                }
            } else {
                finishPendingExport(false, "ذخیره فایل لغو شد یا مسیر معتبری انتخاب نشد.");
            }
            return;
        }
        if (requestCode == REQUEST_OPEN_DOCUMENT && pendingFileChooser != null) {
            Uri[] result = resultCode == RESULT_OK ? selectedUris(data) : null;
            pendingFileChooser.onReceiveValue(result);
            pendingFileChooser = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
        if (pendingExportRequestId != null) {
            notifyNativeFileResult(pendingExportRequestId, false, "برنامه پیش از پایان ذخیره‌سازی بسته شد.");
        }
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
