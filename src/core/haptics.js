/** haptics.js — subtle vibration where supported (Android Chrome). Off switch lives in settings. */
export const haptics = {
  enabled: true,
  pulse(ms) {
    if (!this.enabled) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* unsupported */ }
  },
};
