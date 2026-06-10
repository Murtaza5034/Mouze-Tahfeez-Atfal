package com.mauzetahfeez.myapp;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get the WebView reference once bridge is ready
        getBridge().getWebView().post(() -> {
            webView = getBridge().getWebView();
            if (webView != null) {
                configureWebView();
            }
        });

        // Set up download listener on the Capacitor WebView
        setupDownloadListener();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        // Enable hardware acceleration for smoother rendering
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Enable DOM storage for local caching
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable application cache for offline support (removed in API 34+)

        // Optimize rendering performance
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NARROW_COLUMNS);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // Enable JavaScript (required for Capacitor)
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Enable third-party cookies for authentication
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        // Optimize image loading
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);

        // Enable smooth scrolling (removed in newer API levels)

        // Disable file access restrictions for download functionality
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Handle Android back button - go back in WebView history
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    private void setupDownloadListener() {
        // Capacitor stores the WebView in its bridge — get it once the bridge is ready
        WebView webView = getBridge().getWebView();

        if (webView == null) {
            // Bridge WebView might not be available immediately; retry after layout
            webView.post(this::attachDownloadListener);
        } else {
            attachDownloadListener();
        }
    }

    private void attachDownloadListener() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {

                // Determine a human-readable file name from Content-Disposition or URL
                String fileName = guessFileName(url, contentDisposition, mimeType);

                // Use Android DownloadManager — the most reliable cross-version approach
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

                    // Set title and description for the download notification
                    request.setTitle(fileName);
                    request.setDescription("Downloading from Mauze Tahfeez...");

                    // Allow downloading over mobile and WiFi
                    request.setAllowedOverMetered(true);
                    request.setAllowedOverRoaming(true);

                    // Show download notification
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                    // Save to the public Downloads folder
                    request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS, fileName);

                    // Copy cookies from the WebView so authenticated downloads work
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null && !cookies.isEmpty()) {
                        request.addRequestHeader("Cookie", cookies);
                    }

                    // Set the User-Agent from the WebView
                    request.addRequestHeader("User-Agent", userAgent);

                    // Handle MIME type
                    if (mimeType != null && !mimeType.isEmpty()) {
                        request.setMimeType(mimeType);
                    }

                    // Enqueue the download
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);

                        // Show a toast so the user knows the download started
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(
                                        MainActivity.this,
                                        "Downloading: " + fileName,
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        });
                    }
                } catch (Exception e) {
                    // If DownloadManager fails (e.g. for blob: or data: URLs), fall back to opening in browser
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(
                                    MainActivity.this,
                                    "Download started in browser...",
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                    });

                    Intent intent = new Intent(
                            Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                }
            }
        });
    }

    /**
     * Guesses the file name from the URL and Content-Disposition header.
     * Handles common patterns like:
     *   - Content-Disposition: attachment; filename="report.pdf"
     *   - Content-Disposition: inline; filename*=UTF-8''report%20(1).pdf
     *   - URL ending in /path/to/file.pdf
     */
    private static String guessFileName(String url, String contentDisposition, String mimeType) {
        // First try Android's built-in URLUtil which handles most Content-Disposition patterns
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);

        // Clean up any problematic characters in the filename
        if (fileName != null) {
            // Remove path separators that might have slipped through
            fileName = fileName.replaceAll("[/\\\\:*?\"<>|]", "_");
        }

        return fileName;
    }
}
