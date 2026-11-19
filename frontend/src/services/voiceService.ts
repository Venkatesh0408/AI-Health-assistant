/**
 * Voice service for AI Health Monitor.
 *
 * Manages audio playback from the backend voice synthesis API (ElevenLabs / OpenAI)
 * with automatic, graceful fallback to the browser's native Web Speech API
 * (window.speechSynthesis) whenever an API key is not yet configured or if network fails.
 */

import { api } from './api';

export type VoicePlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

class VoicePlaybackManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private activeMessageId: string | null = null;
  private state: VoicePlaybackState = 'idle';
  private listeners: Set<(state: VoicePlaybackState, messageId: string | null) => void> = new Set();

  public subscribe(listener: (state: VoicePlaybackState, messageId: string | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.state, this.activeMessageId);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: VoicePlaybackState, messageId: string | null = this.activeMessageId): void {
    this.state = newState;
    this.activeMessageId = newState === 'idle' ? null : messageId;
    this.listeners.forEach((fn) => fn(this.state, this.activeMessageId));
  }

  public getActiveMessageId(): string | null {
    return this.activeMessageId;
  }

  public getState(): VoicePlaybackState {
    return this.state;
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setState('idle', null);
  }

  /**
   * Speak the given text aloud.
   * Attempts high-fidelity backend synthesis (ElevenLabs / OpenAI) first,
   * falling back to the browser's speech synthesis engine if needed.
   */
  public async speak(
    messageId: string,
    text: string,
    options: { voiceId?: string } = {}
  ): Promise<void> {
    // If the same message is already playing, clicking again stops it
    if (this.activeMessageId === messageId && (this.state === 'playing' || this.state === 'loading')) {
      this.stop();
      return;
    }

    this.stop();
    this.setState('loading', messageId);

    try {
      // 1. Try Backend API (ElevenLabs / OpenAI)
      const audioBlob = await api.voice.synthesize(text, options.voiceId);
      const url = URL.createObjectURL(audioBlob);
      this.currentObjectUrl = url;

      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onplay = () => {
        this.setState('playing', messageId);
      };

      audio.onended = () => {
        this.stop();
      };

      audio.onerror = () => {
        // Fallback to browser synthesis if audio failed to load
        this.fallbackBrowserSpeech(messageId, text);
      };

      await audio.play();
    } catch {
      // 2. Graceful fallback to Browser Web Speech API
      this.fallbackBrowserSpeech(messageId, text);
    }
  }

  private fallbackBrowserSpeech(messageId: string, text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.stop();
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown symbols for cleaner speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^\s*[-*•]\s*/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/\n+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best natural sounding English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      this.setState('playing', messageId);
    };

    utterance.onend = () => {
      this.stop();
    };

    utterance.onerror = () => {
      this.stop();
    };

    window.speechSynthesis.speak(utterance);
  }
}

export const voiceManager = new VoicePlaybackManager();
