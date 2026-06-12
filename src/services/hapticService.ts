class HapticService {
  private hapticsEnabled(): boolean {
    try {
      const saved = localStorage.getItem('concretePreferences');
      if (!saved) return true;

      const preferences = JSON.parse(saved) as { hapticsEnabled?: boolean };
      return preferences.hapticsEnabled ?? true;
    } catch {
      return true;
    }
  }

  private canUseHaptics(): boolean {
    return (
      this.hapticsEnabled() &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    );
  }

  private trigger(pattern: VibratePattern): void {
    if (!this.canUseHaptics()) {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch {
      // Desktop browsers often do not support vibration; keep haptics as a silent no-op.
    }
  }

  public light(): void {
    this.trigger(10);
  }

  public medium(): void {
    this.trigger(20);
  }

  public heavy(): void {
    this.trigger(30);
  }

  public success(): void {
    this.trigger([10, 40, 10]);
  }

  public warning(): void {
    this.trigger([20, 40, 20]);
  }

  public error(): void {
    this.trigger([30, 40, 30]);
  }

  public selection(): void {
    this.light();
  }

  public button(): void {
    this.light();
  }

  public toggle(): void {
    this.medium();
  }

  public delete(): void {
    this.heavy();
  }

  public modal(): void {
    this.light();
  }

  public save(): void {
    this.success();
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
