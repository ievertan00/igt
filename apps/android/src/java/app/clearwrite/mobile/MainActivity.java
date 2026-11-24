package app.clearwrite.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String HOST = "127.0.0.1";
    private static final int DEVICE_PORT = 5173;
    private static final String HOME = "http://" + HOST + ":" + DEVICE_PORT + "/";

    private WebView webView;
    private LinearLayout connectionPanel;
    private TextView status;
    private Button retry;
    private boolean loadingFailed;
    private boolean keyboardVisible;
    private String requestedPage = HOME;

    @Override
    public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        webView = new WebView(this);
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        connectionPanel = new LinearLayout(this);
        connectionPanel.setOrientation(LinearLayout.VERTICAL);
        connectionPanel.setGravity(Gravity.CENTER);
        connectionPanel.setBackgroundColor(Color.WHITE);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        connectionPanel.setPadding(padding, padding, padding, padding);
        status = new TextView(this);
        status.setGravity(Gravity.CENTER);
        status.setTextSize(16);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        connectionPanel.addView(status);
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(view -> loadPage(requestedPage));
        connectionPanel.addView(retry);
        root.addView(connectionPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        configureInsets(root);

        String savedPage = savedState == null ? null : savedState.getString("page");
        loadPage(savedPage != null && isAppUrl(Uri.parse(savedPage)) ? savedPage : HOME);
    }

    private void configureInsets(FrameLayout root) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(appearance, appearance);
            }
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets edges = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(edges.left, edges.top, edges.right, edges.bottom);
                boolean imeVisible = insets.isVisible(WindowInsets.Type.ime());
                if (keyboardVisible != imeVisible) {
                    keyboardVisible = imeVisible;
                    updateKeyboardState();
                }
                return WindowInsets.CONSUMED;
            });
        } else {
            getWindow().setStatusBarColor(Color.WHITE);
            getWindow().setNavigationBarColor(Color.WHITE);
            root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setUserAgentString(settings.getUserAgentString() + " ClearWriteAndroid/1");
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isAppUrl(url)) return false;
                String scheme = url.getScheme();
                if (request.isForMainFrame() && request.hasGesture()
                        && ("https".equals(scheme) || "http".equals(scheme))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (ActivityNotFoundException ignored) {
                        // Leave the current page visible if no browser is installed.
                    }
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (isAppUrl(Uri.parse(url))) requestedPage = url;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (!loadingFailed && isAppUrl(Uri.parse(url))) {
                    updateKeyboardState();
                    connectionPanel.setVisibility(View.GONE);
                    view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showConnectionError();
            }
        });
    }

    private static boolean isAppUrl(Uri url) {
        return "http".equals(url.getScheme()) && HOST.equals(url.getHost())
            && url.getPort() == DEVICE_PORT && url.getUserInfo() == null;
    }

    private void updateKeyboardState() {
        if (Build.VERSION.SDK_INT < 30) return;
        String url = webView == null ? null : webView.getUrl();
        if (url != null && isAppUrl(Uri.parse(url))) {
            webView.evaluateJavascript("document.documentElement?.setAttribute('data-clearwrite-ime', '"
                + keyboardVisible + "')", null);
        }
    }

    private void loadPage(String url) {
        loadingFailed = false;
        status.setText(R.string.connecting);
        retry.setVisibility(View.GONE);
        connectionPanel.setVisibility(View.VISIBLE);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        webView.loadUrl(url);
    }

    private void showConnectionError() {
        loadingFailed = true;
        status.setText(R.string.disconnected);
        retry.setVisibility(View.VISIBLE);
        connectionPanel.setVisibility(View.VISIBLE);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }

    @Override
    public void onBackPressed() {
        if (!loadingFailed && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        String url = webView.getUrl();
        outState.putString("page", !loadingFailed && url != null && isAppUrl(Uri.parse(url)) ? url : requestedPage);
    }

    @Override
    protected void onDestroy() {
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
