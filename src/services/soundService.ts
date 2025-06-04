import { usePreferencesStore } from '../store';

// Sound service for managing audio playback
class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private initialized: boolean = false;
  private lastPlayTimes: { [key: string]: number } = {};
  private minTimeBetweenPlays: number = 800; // Increase debounce time to prevent duplicate sounds
  
  // Sound mapping for different action types
  private soundMapping: { [key: string]: string } = {
    // Direct sounds
    'success': 'success',
    'click': 'click', 
    'delete': 'delete',
    
    // Toast type mappings - avoid duplicate delete sounds
    'error': 'click',      // Use click sound for error toasts (less jarring)
    'warning': 'click',    // Use click sound for warnings (neutral)
    'info': 'click',       // Use click sound for info (neutral)
    
    // Action mappings
    'toggle': 'success',   // For toggles/sliders
    'modal': 'click',      // For modal opening
    'trash': 'delete',     // For trash icon clicks
  };

  constructor() {
    console.log('🔊 Initializing Sound Service');
  }

  private loadLocalSound(soundName: string): string {
    // Use local assets instead of Supabase
    return `/assets/sounds/${soundName}.wav`;
  }

  public async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 Loading sounds from local assets...');
      // Load the actual sound files we have
      const soundFiles = ['success', 'click', 'delete'];
      
      // Load all sounds
      soundFiles.forEach((name) => {
        const url = this.loadLocalSound(name);
        this.sounds[name] = new Audio(url);
        
        // Set volumes 30% quieter than previous settings
        if (name === 'click') {
          this.sounds[name].volume = 0.21; // was 0.3, now 30% quieter
        } else if (name === 'delete') {
          this.sounds[name].volume = 0.28; // was 0.4, now 30% quieter  
        } else {
          this.sounds[name].volume = 0.35; // was 0.5, now 30% quieter
        }
        
        // Add event listeners for debugging
        this.sounds[name].addEventListener('play', () => console.log(`🎵 Playing ${name} sound`));
        this.sounds[name].addEventListener('error', (e) => console.error(`🔇 Error loading ${name} sound:`, e));
        
        // Preload the audio
        this.sounds[name].load();
      });

      this.initialized = true;
      console.log('✅ Sounds loaded successfully');
    } catch (error) {
      console.error('💥 Error initializing sounds:', error);
    }
  }

  private canPlaySound(soundName: string): boolean {
    const now = Date.now();
    const lastPlayTime = this.lastPlayTimes[soundName] || 0;
    return now - lastPlayTime >= this.minTimeBetweenPlays;
  }

  public async play(soundName: string): Promise<void> {
    const preferences = usePreferencesStore.getState().preferences;
    
    if (!preferences.soundEnabled) {
      console.log('🔇 Sound disabled in preferences');
      return;
    }

    // Initialize if not already done
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Map the requested sound to an actual sound file
    const actualSoundName = this.soundMapping[soundName] || soundName;
    
    // Check if we can play the sound (debouncing)
    if (!this.canPlaySound(actualSoundName)) {
      console.log(`🔇 Skipping ${actualSoundName} sound (too soon after last play)`);
      return;
    }
    
    const sound = this.sounds[actualSoundName];
    if (sound) {
      try {
        // Update last play time
        this.lastPlayTimes[actualSoundName] = Date.now();
        
        // If the sound is already playing, stop it first
        if (!sound.paused) {
          sound.pause();
          sound.currentTime = 0;
        }
        
        sound.currentTime = 0; // Reset the audio to start
        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log(`✅ ${actualSoundName} sound played successfully (requested: ${soundName})`))
            .catch(error => {
              console.warn(`❌ Sound "${actualSoundName}" failed to play:`, error);
              // Try to play again with user interaction
              const playSound = () => {
                sound.play().catch(() => {});
                document.removeEventListener('click', playSound);
              };
              document.addEventListener('click', playSound, { once: true });
            });
        }
      } catch (error) {
        console.error(`💥 Error playing ${actualSoundName} sound:`, error);
      }
    } else {
      console.warn(`⚠️ Sound "${actualSoundName}" not found (requested: ${soundName})`);
    }
  }

  public addSound(name: string, url: string): void {
    console.log(`➕ Adding new sound: ${name}`);
    this.sounds[name] = new Audio(url);
    this.sounds[name].volume = 0.35; // 30% quieter than the previous default of 0.5
  }
  
  // Method to test all available sounds
  public async testSounds(): Promise<void> {
    console.log('🧪 Testing all sounds...');
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    await this.play('success');
    await delay(1000);
    await this.play('click');
    await delay(1000);
    await this.play('delete');
  }
}

// Create a singleton instance
export const soundService = new SoundService(); 