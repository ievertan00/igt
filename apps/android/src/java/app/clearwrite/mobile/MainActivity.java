package app.clearwrite.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.GradientDrawable;
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

import org.json.JSONObject;

/** Native shell for the standalone ClearWrite mobile UI.
 *  The shell owns system integration only: insets, theme, keyboard/back
 *  behaviour, connection state, share intake and the JavaScript bridge.
 *  Everything visible inside the WebView comes from apps/mobile. */
@SuppressWarnings("deprecation")
public final class MainActivity extends Activity {
    private static final String HOST = "127.0.0.1";
    private static final int DEVICE_PORT = 5173;
    private static final String HOME = "http://" + HOST + ":" + DEVICE_PORT + "/mobile/";
    private static final String BRIDGE_NAME = "IgtBridge";

    private WebView webView;
    private FrameLayout root;
    private LinearLayout connectionPanel;
    private TextView status;
    private TextView steps;
    private Button retry;
    private IgtBridge bridge;
    private boolean loadingFailed;
    private boolean keyboardVisible;
    private String requestedPage = HOME;
    private int insetTop, insetRight, insetBottom, insetLeft;

    @Override
    public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        boolean dark = isDark();

        root = new FrameLayout(this);
        root.setBackgroundColor(dark ? Color.parseColor("#0F1626") : Color.parseColor("#F6F8FB"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        bridge = new IgtBridge(this, root, extractSharedText(getIntent()));

        connectionPanel = buildConnectionPanel(dark);
        root.addView(connectionPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        configureSystemBars(dark);
        configureInsets();

        String savedPage = savedState == null ? null : savedState.getString("page");
        loadPage(savedPage != null && isAppUrl(Uri.parse(savedPage)) ? savedPage : HOME);
    }

    /* ------------------------------------------------------------ UI shell -- */
    private LinearLayout buildConnectionPanel(boolean dark) {
        int dp = (int) getResources().getDisplayMetrics().density;
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setBackgroundColor(dark ? Color.parseColor("#0F1626") : Color.parseColor("#F6F8FB"));
        panel.setPadding(28 * dp, 24 * dp, 28 * dp, 24 * dp);

        TextView mark = new TextView(this);
        GradientDrawable badge = new GradientDrawable();
        badge.setColor(Color.parseColor(dark ? "#2FBE63" : "#166534"));
        badge.setCornerRadius(16 * dp);
        mark.setBackground(badge);
        mark.setGravity(Gravity.CENTER);
        mark.setText("CW");
        mark.setTextColor(Color.parseColor(dark ? "#08150E" : "#FFFFFF"));
        mark.setTextSize(19);
        LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(54 * dp, 54 * dp);
        markParams.bottomMargin = 18 * dp;
        panel.addView(mark, markParams);

        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setTextColor(dark ? Color.parseColor("#F6F8FB") : Color.parseColor("#101827"));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        panel.addView(title);

        status = new TextView(this);
        status.setTextSize(15);
        status.setGravity(Gravity.CENTER);
        status.setTextColor(dark ? Color.parseColor("#C5D2E2") : Color.parseColor("#475569"));
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-2, -2);
        statusParams.topMargin = 14 * dp;
        panel.addView(status, statusParams);

        steps = new TextView(this);
        steps.setTextSize(13);
        steps.setGravity(Gravity.CENTER);
        steps.setTextColor(dark ? Color.parseColor("#94A3B8") : Color.parseColor("#64748B"));
        steps.setText(R.string.connection_steps);
        steps.setLineSpacing(4 * dp, 1f);
        LinearLayout.LayoutParams stepsParams = new LinearLayout.LayoutParams(-2, -2);
        stepsParams.topMargin = 18 * dp;
        panel.addView(steps, stepsParams);

        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setTextColor(Color.parseColor(dark ? "#08150E" : "#FFFFFF"));
        retry.setTextSize(15);
        retry.setAllCaps(false);
        GradientDrawable button = new GradientDrawable();
        button.setColor(Color.parseColor(dark ? "#2FBE63" : "#101827"));
        button.setCornerRadius(14 * dp);
        retry.setBackground(button);
        retry.setOnClickListener(view -> loadPage(requestedPage));
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(180 * dp, 48 * dp);
        retryParams.topMargin = 22 * dp;
        panel.addView(retry, retryParams);
        return panel;
    }

    private boolean isDark() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void configureSystemBars(boolean dark) {
        int surface = dark ? Color.parseColor("#151E2E") : Color.parseColor("#FFFFFF");
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
        } else {
            getWindow().setStatusBarColor(surface);
            getWindow().setNavigationBarColor(surface);
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(dark ? (flags & ~mask) : (flags | mask));
        }
    }

    private void configureInsets() {
        float density = getResources().getDisplayMetrics().density;
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetTop = Math.round(bars.top / density);
                insetRight = Math.round(bars.right / density);
                insetBottom = Math.round(bars.bottom / density);
                insetLeft = Math.round(bars.left / density);
                injectInsets();
                boolean ime = insets.isVisible(WindowInsets.Type.ime());
                if (keyboardVisible != ime) {
                    keyboardVisible = ime;
                    injectIme();
                }
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
    }

    private void injectInsets() {
        if (webView == null) return;
        webView.evaluateJavascript("window.__igtInsets && window.__igtInsets("
            + insetTop + "," + insetRight + "," + insetBottom + "," + insetLeft + ")", null);
    }

    private void injectIme() {
        if (webView == null || !isAppUrl(Uri.parse(String.valueOf(webView.getUrl())))) return;
        webView.evaluateJavascript("document.documentElement && document.documentElement.setAttribute('data-igt-ime', '"
            + keyboardVisible + "')", null);
    }

    private void injectTheme() {
        if (webView == null) return;
        webView.evaluateJavascript("window.__igtTheme && window.__igtTheme('"
            + (isDark() ? "dark" : "light") + "')", null);
    }

    /* ------------------------------------------------------------- WebView -- */
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setUserAgentString(settings.getUserAgentString() + " ClearWriteMobile/2");
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
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
                if (isAppUrl(Uri.parse(url))) {
                    requestedPage = url;
                    view.addJavascriptInterface(bridge, BRIDGE_NAME);
                } else {
                    view.removeJavascriptInterface(BRIDGE_NAME);
                }
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (!isAppUrl(Uri.parse(url))) return;
                injectInsets();
                injectTheme();
                injectIme();
                String shared = extractSharedText(getIntent());
                if (shared != null) {
                    bridge.setSharedText(shared);
                    deliverSharedText(shared);
                    setIntent(new Intent(MainActivity.this, MainActivity.class)
                        .setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER));
                }
                if (!loadingFailed) {
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
        return url != null && "http".equals(url.getScheme()) && HOST.equals(url.getHost())
            && url.getPort() == DEVICE_PORT && url.getUserInfo() == null
            && url.getPath() != null && url.getPath().startsWith("/mobile/");
    }

    private void loadPage(String url) {
        loadingFailed = false;
        status.setText(R.string.connecting);
        steps.setVisibility(View.GONE);
        retry.setVisibility(View.GONE);
        connectionPanel.setVisibility(View.VISIBLE);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        if (isAppUrl(Uri.parse(url))) webView.addJavascriptInterface(bridge, BRIDGE_NAME);
        else webView.removeJavascriptInterface(BRIDGE_NAME);
        webView.loadUrl(url);
    }

    private void showConnectionError() {
        loadingFailed = true;
        status.setText(R.string.disconnected);
        steps.setVisibility(View.VISIBLE);
        retry.setVisibility(View.VISIBLE);
        connectionPanel.setVisibility(View.VISIBLE);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }

    private void deliverSharedText(String text) {
        if (webView == null || text == null) return;
        webView.evaluateJavascript("window.__igtShared && window.__igtShared("
            + JSONObject.quote(text) + ")", null);
    }

    private static String extractSharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())
                || !"text/plain".equals(intent.getType())) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return null;
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /* ------------------------------------------------------------ lifecycle -- */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String shared = extractSharedText(intent);
        if (shared == null) return;
        bridge.setSharedText(shared);
        deliverSharedText(shared);
    }

    @Override
    protected void onResume() {
        super.onResume();
        injectTheme();
    }

    @Override
    public void onBackPressed() {
        if (loadingFailed || webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("(window.__igtBack && window.__igtBack()) === true", value -> {
            boolean handled = value != null && value.replace("\"", "").trim().equals("true");
            if (!handled) {
                if (webView.canGoBack()) webView.goBack();
                else super.onBackPressed();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        String url = webView.getUrl();
        outState.putString("page", !loadingFailed && url != null && isAppUrl(Uri.parse(url)) ? url : requestedPage);
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) bridge.destroy();
        if (webView != null) {
            webView.removeJavascriptInterface(BRIDGE_NAME);
            ((FrameLayout) webView.getParent()).removeView(webView);
            webView.destroy();
        }
        super.onDestroy();
    }
}
