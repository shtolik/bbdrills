type Params = Record<string, any>;

class AnalyticsHelper {
  private impressionSent = new Set<string>();
  private openSent = new Set<string>();
  private playSent = new Set<string>();

  init() {
    // Expose a no-op gtag to avoid runtime errors if GA isn't loaded yet
    try {
      if (!(window as any).gtag) {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).gtag = function () {
          (window as any).dataLayer.push(arguments);
        };
      }
    } catch (e) {
      // silent
    }
  }

  sendEvent(name: string, params: Params = {}) {
    try {
      if ((window as any).gtag) {
        (window as any).gtag('event', name, params);
      } else if ((window as any).dataLayer) {
        (window as any).dataLayer.push({ event: name, ...params });
      }
    } catch (e) {
      // ignore telemetry errors
    }
  }

  trackDrillImpression(drillId: string, extra: Params = {}) {
    if (this.impressionSent.has(drillId)) return;
    this.impressionSent.add(drillId);
    this.sendEvent('drill_impression', { drill_id: drillId, ...extra });
  }

  trackDrillOpen(drillId: string, method: 'modal' | 'page' = 'modal', extra: Params = {}) {
    if (this.openSent.has(drillId)) return;
    this.openSent.add(drillId);
    this.sendEvent('drill_open', { drill_id: drillId, method, ...extra });
  }

  trackDrillPlayStart(drillId: string, playerType: string = 'youtube', extra: Params = {}) {
    const key = drillId + '::start';
    if (this.playSent.has(key)) return;
    this.playSent.add(key);
    this.sendEvent('drill_play_start', { drill_id: drillId, player: playerType, ...extra });
  }

  trackDrillPlayProgress(drillId: string, seconds: number, extra: Params = {}) {
    // send progress milestone events (e.g., 5s, 15s, 30s)
    const sec = Math.floor(seconds);
    const key = `${drillId}::p${sec}`;
    if (this.playSent.has(key)) return;
    // only send for milestone seconds to avoid noise
    const milestones = [5, 10, 30, 60];
    if (!milestones.includes(sec)) return;
    this.playSent.add(key);
    this.sendEvent('drill_play_progress', { drill_id: drillId, seconds: sec, ...extra });
  }
}

export const analytics = new AnalyticsHelper();
export default analytics;
