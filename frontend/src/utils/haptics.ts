import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const runNativeHaptic = (action: () => Promise<void>) => {
  if (!Capacitor.isNativePlatform()) return;

  void action().catch(() => {
    // Haptics are an optional native enhancement, so an unavailable device must not affect the app.
  });
};

/** A quiet acknowledgement that an AI response has fully finished. */
export const triggerAiResponseCompleteHaptic = () => {
  runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
};

/** A light confirmation when a task is completed. */
export const triggerSuccessHaptic = () => {
  runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
};

/** A quiet tactile acknowledgement for a long-press or picking up a drag item. */
export const triggerSelectionHaptic = () => {
  runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
};

/** A distinct but restrained warning for an AI limit or failed AI request. */
export const triggerWarningHaptic = () => {
  runNativeHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
};
