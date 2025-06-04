import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { usePreferencesStore } from '../store';

// Haptic service for managing haptic feedback
class HapticService {
  private initialized: boolean = false;
  private isSupported: boolean = false;

  constructor() {
    console.log('📳 Initializing Haptic Service');
    this.initialize();
  }

  private async initialize() {
    try {
      // Check if haptics are supported on this platform
      this.isSupported = 'Capacitor' in window;
      
      if (this.isSupported) {
        console.log('✅ Haptics supported on this platform');
      } else {
        console.log('❌ Haptics not supported on this platform (web browser)');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('💥 Error initializing haptics:', error);
      this.isSupported = false;
      this.initialized = true;
    }
  }

  private async canUseHaptics(): Promise<boolean> {
    const preferences = usePreferencesStore.getState().preferences;
    
    // Check if haptics are enabled in user preferences
    const hapticsEnabled = preferences.hapticsEnabled ?? true; // Default to enabled
    
    if (!hapticsEnabled) {
      console.log('📳 Haptics disabled in user preferences');
      return false;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    return this.isSupported;
  }

  // Light haptic feedback for subtle interactions (buttons, taps)
  public async light(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      console.log('📳 Light haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Light haptic failed:', error);
    }
  }

  // Medium haptic feedback for standard interactions (toggles, selections)
  public async medium(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      console.log('📳 Medium haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Medium haptic failed:', error);
    }
  }

  // Heavy haptic feedback for important actions (delete, errors)
  public async heavy(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      console.log('📳 Heavy haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Heavy haptic failed:', error);
    }
  }

  // Success haptic feedback for positive actions
  public async success(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Success });
      console.log('📳 Success haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Success haptic failed:', error);
    }
  }

  // Warning haptic feedback for cautionary actions
  public async warning(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Warning });
      console.log('📳 Warning haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Warning haptic failed:', error);
    }
  }

  // Error haptic feedback for errors and destructive actions
  public async error(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Error });
      console.log('📳 Error haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Error haptic failed:', error);
    }
  }

  // Selection haptic feedback for item selection
  public async selection(): Promise<void> {
    if (!(await this.canUseHaptics())) return;
    
    try {
      await Haptics.selectionStart();
      console.log('📳 Selection haptic feedback triggered');
    } catch (error) {
      console.warn('⚠️ Selection haptic failed:', error);
    }
  }

  // Convenience methods for common UI interactions
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

  // Test all haptic types
  public async testHaptics(): Promise<void> {
    if (!(await this.canUseHaptics())) {
      console.log('📳 Cannot test haptics - not supported or disabled');
      return;
    }

    console.log('🧪 Testing all haptic types...');
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
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

// Create a singleton instance
export const hapticService = new HapticService(); 