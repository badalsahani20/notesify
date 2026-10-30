package in.notesify.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupSystemBars();
        preventDoubleKeyboardInsets();
        enableHighRefreshRate();
    }

    /**
     * Capacitor 8's SystemBars listener applies keyboard-height padding to the window decor
     * view and also forwards the IME inset to the WebView. On affected Android/WebView
     * combinations that resizes the page twice, leaving an empty block above the keyboard.
     *
     * Keep the raw insets flowing to the WebView, but do not reserve that same space on the
     * native decor view. This targets the view where Capacitor applies the padding; clearing
     * padding on the WebView or its CoordinatorLayout parent is too late in the inset chain.
     */
    private void preventDoubleKeyboardInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            view.setPadding(0, 0, 0, 0);
            return insets;
        });
        getWindow().getDecorView().requestApplyInsets();
    }

    /**
     * Styles the native Android status bar and navigation bar to match Notesify's dark theme.
     */
    private void setupSystemBars() {
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#09090b"));
        window.setNavigationBarColor(Color.parseColor("#09090b"));

        // Ensure white/light status bar and navigation bar icons on dark #09090b
        androidx.core.view.WindowInsetsControllerCompat controller = 
            androidx.core.view.WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    /**
     * Unlocks 90Hz / 120Hz / 144Hz display modes on high-refresh-rate Android devices.
     */
    private void enableHighRefreshRate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Window window = getWindow();
            Display display = getWindowManager().getDefaultDisplay();
            Display.Mode[] modes = display.getSupportedModes();
            Display.Mode maxMode = null;
            float maxRefreshRate = 60.0f;

            for (Display.Mode mode : modes) {
                if (mode.getRefreshRate() > maxRefreshRate) {
                    maxRefreshRate = mode.getRefreshRate();
                    maxMode = mode;
                }
            }

            if (maxMode != null) {
                WindowManager.LayoutParams params = window.getAttributes();
                params.preferredDisplayModeId = maxMode.getModeId();
                window.setAttributes(params);
            }
        }
    }
}
