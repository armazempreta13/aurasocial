'use client';

/**
 * Aura Sound Effects System
 * Premium curated sounds for UI interactions
 */

const SOUND_URLS = {
  pop: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',       // Chat message / Subtle alert
  reaction: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',  // Gentle click for reactions
  success: 'https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3',   // Swoosh for sending posts
  notification: 'https://assets.mixkit.co/active_storage/sfx/2210/2210-preview.mp3', // Chime for new notifications
  delete: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',   // Subtle crunch/trash
};

class SoundEffects {
  private cache: Record<string, HTMLAudioElement> = {};

  play(soundKey: keyof typeof SOUND_URLS) {
    if (typeof window === 'undefined') return;

    try {
      if (!this.cache[soundKey]) {
        this.cache[soundKey] = new Audio(SOUND_URLS[soundKey]);
        this.cache[soundKey].volume = 0.4; // Keep it subtle and premium
      }

      const audio = this.cache[soundKey];
      
      // If already playing, reset to start to allow rapid fire (like multiple reactions)
      if (!audio.paused) {
        audio.currentTime = 0;
      } else {
        audio.play().catch(() => {
          // Ignore autoplay blocks - common in browsers until first user interaction
        });
      }
    } catch (e) {
      console.warn('Sound effect failed to play:', e);
    }
  }
}

export const soundEffects = new SoundEffects();
