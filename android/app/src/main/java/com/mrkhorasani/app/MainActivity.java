package com.mrkhorasani.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
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

import java.io.OutputStream;
import android.util.Base64;

public final class MainActivity extends Activity {
    private static final int REQUEST_CREATE_DOCUMENT = 4101;
    private static final int REQUEST_OPEN_DOCUMENT = 4102;
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";

    private WebView webView;
    private byte[] pendingExportBytes;
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
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
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
        webView.loadUrl("https://" + APP_ASSET_HOST + "/assets/index.html");
    }

    private void openExternal(Uri uri) {
        if (uri == null || uri.getScheme() == null) return;
        String scheme = uri.getScheme().toLowerCase();
        if (!scheme.equals("https") && !scheme.equals("mailto") && !scheme.equals("tel")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "برنامه‌ای برای باز کردن این پیوند پیدا نشد", Toast.LENGTH_SHORT).show();
        }
    }

    private final class NativeExportBridge {
        @JavascriptInterface
        public void saveFile(String fileName, String mimeType, String base64Data) {
            try {
                pendingExportBytes = Base64.decode(base64Data, Base64.DEFAULT);
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType == null || mimeType.isEmpty()
                            ? "application/octet-stream" : mimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, safeFileName(fileName));
                    try {
                        startActivityForResult(intent, REQUEST_CREATE_DOCUMENT);
                    } catch (ActivityNotFoundException error) {
                        pendingExportBytes = null;
                        Toast.makeText(MainActivity.this, "ذخیره‌ساز فایل در دسترس نیست", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (IllegalArgumentException error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "ساخت فایل خروجی ناموفق بود", Toast.LENGTH_LONG).show());
            }
        }
    }

    private String safeFileName(String value) {
        if (value == null || value.trim().isEmpty()) return "MR-KHORASANI-export";
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CREATE_DOCUMENT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingExportBytes != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new IllegalStateException("Output stream unavailable");
                    output.write(pendingExportBytes);
                    output.flush();
                    Toast.makeText(this, "فایل با موفقیت ذخیره شد", Toast.LENGTH_LONG).show();
                } catch (Exception error) {
                    Toast.makeText(this, "ذخیره فایل ناموفق بود: " + error.getMessage(),
                            Toast.LENGTH_LONG).show();
                }
            }
            pendingExportBytes = null;
            return;
        }
        if (requestCode == REQUEST_OPEN_DOCUMENT && pendingFileChooser != null) {
            Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null
                    ? new Uri[]{data.getData()} : null;
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
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
