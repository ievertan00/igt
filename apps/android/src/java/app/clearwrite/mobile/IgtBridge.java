package app.clearwrite.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import java.util.Locale;

/** Native capabilities exposed to the standalone mobile UI.
 *  The interface is attached only while an app-owned URL is loaded. */
public final class IgtBridge {
    private final Activity activity;
    private final View hapticView;
    private TextToSpeech tts;
    private boolean ttsReady;
    private String sharedText;

    IgtBridge(Activity activity, View hapticView, String sharedText) {
        this.activity = activity;
        this.hapticView = hapticView;
        this.sharedText = sharedText == null ? "" : sharedText;
        hapticView.setHapticFeedbackEnabled(true);
        tts = new TextToSpeech(activity, status -> {
            if (status == TextToSpeech.SUCCESS) {
                try {
                    tts.setLanguage(Locale.US);
                    ttsReady = true;
                } catch (RuntimeException ignored) {
                    ttsReady = false;
                }
            }
        });
    }

    @JavascriptInterface
    public void haptic(String kind) {
        activity.runOnUiThread(() -> {
            int feedback = "err".equals(kind)
                ? HapticFeedbackConstants.LONG_PRESS
                : "ok".equals(kind)
                    ? HapticFeedbackConstants.VIRTUAL_KEY
                    : HapticFeedbackConstants.KEYBOARD_TAP;
            hapticView.performHapticFeedback(feedback, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING);
        });
    }

    /** Offline, system-level pronunciation. The web layer falls back to the
     *  Local Runtime TTS endpoint when no native bridge is present. */
    @JavascriptInterface
    public void speak(String text) {
        if (text == null || text.trim().isEmpty()) return;
        activity.runOnUiThread(() -> {
            if (!ttsReady) return;
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, 3);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "igt-mobile");
        });
    }

    @JavascriptInterface
    public void copy(String text) {
        if (text == null) return;
        activity.runOnUiThread(() -> {
            ClipboardManager manager = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager != null) manager.setPrimaryClip(ClipData.newPlainText("ClearWrite", text));
        });
    }

    @JavascriptInterface
    public void share(String text) {
        if (text == null || text.isEmpty()) return;
        activity.runOnUiThread(() -> {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            try {
                activity.startActivity(Intent.createChooser(send, null));
            } catch (RuntimeException ignored) {
                // No activity can handle the share intent.
            }
        });
    }

    @JavascriptInterface
    public String paste() {
        try {
            ClipboardManager manager = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = manager == null ? null : manager.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0 && clip.getItemAt(0).getText() != null) {
                return clip.getItemAt(0).getText().toString();
            }
        } catch (RuntimeException ignored) {
            // Clipboard access is denied on locked screens.
        }
        return "";
    }

    @JavascriptInterface
    public String sharedText() {
        return sharedText;
    }

    void setSharedText(String value) {
        sharedText = value == null ? "" : value;
    }

    @JavascriptInterface
    public String locale() {
        return Locale.getDefault().getLanguage().equals("zh") ? "zh" : "en";
    }

    @JavascriptInterface
    public String theme() {
        int mode = activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES ? "dark" : "light";
    }

    @JavascriptInterface
    public void setKeepScreenOn(boolean on) {
        activity.runOnUiThread(() -> {
            if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    void destroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        ttsReady = false;
    }
}
