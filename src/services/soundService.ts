import { usePreferencesStore } from '../store';
import { supabase } from '../lib/supabaseClient';

// Sound service for managing audio playback
class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private soundUrls: { [key: string]: string } = {};
  private initialized: boolean = false;
  private lastPlayTimes: { [key: string]: number } = {};
  private minTimeBetweenPlays: number = 200; // Minimum time between plays in milliseconds

  constructor() {
    console.log('🔊 Initializing Sound Service');
  }

  private async loadSoundFromSupabase(soundName: string): Promise<string> {
    try {
      // Check if we already have the URL cached
      if (this.soundUrls[soundName]) {
        return this.soundUrls[soundName];
      }

      // Get the public URL directly since the bucket is public
      const { data } = supabase
        .storage
        .from('sounds')
        .getPublicUrl(`${soundName}.wav`);

      if (!data?.publicUrl) {
        throw new Error('No public URL received');
      }

      // Cache the URL
      this.soundUrls[soundName] = data.publicUrl;
      return data.publicUrl;
    } catch (error) {
      console.error(`Failed to load sound ${soundName}:`, error);
      return '';
    }
  }

  public async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 Loading sounds from Supabase...');
      // Only load the sounds we know exist
      const soundNames = ['success', 'click', 'delete'];
      
      // Load all sounds in parallel
      await Promise.all(soundNames.map(async (name) => {
        const url = await this.loadSoundFromSupabase(name);
        if (url) {
          this.sounds[name] = new Audio(url);
          // Set appropriate volumes
          this.sounds[name].volume = name === 'click' ? 0.3 : name === 'delete' ? 0.4 : 0.5;
          
          // Add event listeners for debugging
          this.sounds[name].addEventListener('play', () => console.log(`🎵 Playing ${name} sound`));
          this.sounds[name].addEventListener('error', (e) => console.error(`🔇 Error loading ${name} sound:`, e));
        }
      }));

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
    
    // Check if we can play the sound (debouncing)
    if (!this.canPlaySound(soundName)) {
      console.log(`🔇 Skipping ${soundName} sound (too soon after last play)`);
      return;
    }
    
    const sound = this.sounds[soundName];
    if (sound) {
      try {
        // Update last play time
        this.lastPlayTimes[soundName] = Date.now();
        
        // If the sound is already playing, stop it first
        if (!sound.paused) {
          sound.pause();
          sound.currentTime = 0;
        }
        
        sound.currentTime = 0; // Reset the audio to start
        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log(`✅ ${soundName} sound played successfully`))
            .catch(error => {
              console.warn(`❌ Sound "${soundName}" failed to play:`, error);
              // Try to play again with user interaction
              const playSound = () => {
                sound.play();
                document.removeEventListener('click', playSound);
              };
              document.addEventListener('click', playSound);
            });
        }
      } catch (error) {
        console.error(`💥 Error playing ${soundName} sound:`, error);
      }
    } else {
      console.warn(`⚠️ Sound "${soundName}" not found`);
    }
  }

  public addSound(name: string, url: string): void {
    console.log(`➕ Adding new sound: ${name}`);
    this.sounds[name] = new Audio(url);
    this.sounds[name].volume = 0.5;
  }
}

// Create a singleton instance
export const soundService = new SoundService(); 