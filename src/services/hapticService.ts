import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { usePreferencesStore } from '../store';

/** Native apps use Capacitor Haptics; web only when Vibrate API exists (e.g. not Firefox). */
function detectPlatformHapticSupport(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

const platformHapticSupport = detectPlatformHapticSupport();

let unsupportedDevLogged = false;

function logUnsupportedOnceDev(): void {
  if (unsupportedDevLogged || !import.meta.env.DEV || platformHapticSupport) {
    return;
  }
  unsupportedDevLogged = true;
  console.debug(
    '[haptics] Vibrate API unavailable in this browser; haptic feedback skipped on web.',
  );
}

class HapticService {
  private canUseHaptics(): boolean {
    if (!platformHapticSupport) {
      logUnsupportedOnceDev();
      return false;
    }

    const hapticsEnabled = usePreferencesStore.getState().preferences.hapticsEnabled ?? true;
    return hapticsEnabled;
  }

  private async trigger(action: () => Promise<void>): Promise<void> {
    if (!this.canUseHaptics()) {
      return;
    }

    try {
      await action();
    } catch {
      // Unsupported web paths are gated above; native failures stay quiet in production.
    }
  }

  public async light(): Promise<void> {
    await this.trigger(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  public async medium(): Promise<void> {
    await this.trigger(() => Haptics.impact({ style: ImpactStyle.Medium }));
  }

  public async heavy(): Promise<void> {
    await this.trigger(() => Haptics.impact({ style: ImpactStyle.Heavy }));
  }

  public async success(): Promise<void> {
    await this.trigger(() =>
      Haptics.notification({ type: NotificationType.Success }),
    );
  }

  public async warning(): Promise<void> {
    await this.trigger(() =>
      Haptics.notification({ type: NotificationType.Warning }),
    );
  }

  public async error(): Promise<void> {
    await this.trigger(() =>
      Haptics.notification({ type: NotificationType.Error }),
    );
  }

  public async selection(): Promise<void> {
    await this.trigger(() => Haptics.selectionStart());
  }

  public async button(): Promise<void> {
    await this.light();
  }

  public async toggle(): Promise<void> {
    await this.medium();
  }

  public async delete(): Promise<void> {
    await this.heavy();
  }

  public async modal(): Promise<void> {
    await this.light();
  }

  public async save(): Promise<void> {
    await this.success();
  }

  public async testHaptics(): Promise<void> {
    if (!this.canUseHaptics()) {
      return;
    }

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    await this.light();
    await delay(500);
    await this.medium();
    await delay(500);
    await this.heavy();
    await delay(500);
    await this.success();
    await delay(500);
    await this.warning();
    await delay(500);
    await this.error();
    await delay(500);
    await this.selection();
  }
}

export const hapticService = new HapticService();
