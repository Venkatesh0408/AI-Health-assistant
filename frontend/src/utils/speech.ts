// Multi-language Voice Input (STT) & Voice Output (TTS) Utilities

// Cross-browser SpeechRecognition typing
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

/** Check if browser supports Web Speech API for voice recognition */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** Check if browser supports Web Speech API text-to-speech */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export interface StartRecognitionOptions {
  lang: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (errorMessage: string) => void;
  onEnd: () => void;
  onStart?: () => void;
}

export interface SpeechRecognitionController {
  stop: () => void;
}

/**
 * Start listening via browser microphone using SpeechRecognition.
 */
export function startSpeechRecognition(
  options: StartRecognitionOptions
): SpeechRecognitionController {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    options.onError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    options.onEnd();
    return { stop: () => {} };
  }

  const recognition = new SpeechRec();
  recognition.lang = options.lang || 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      const text = result[0]?.transcript || '';
      if (result.isFinal) {
        finalTranscript += text;
      } else {
        interimTranscript += text;
      }
    }

    const transcript = finalTranscript || interimTranscript;
    if (transcript) {
      options.onResult(transcript, Boolean(finalTranscript));
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    let userMsg = 'Microphone error.';
    if (event.error === 'not-allowed') {
      userMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
    } else if (event.error === 'no-speech') {
      userMsg = 'No speech detected. Please speak clearly into your microphone.';
    } else if (event.error === 'network') {
      userMsg = 'Network error during voice recognition.';
    }
    options.onError(userMsg);
  };

  recognition.onend = () => {
    options.onEnd();
  };

  try {
    recognition.start();
  } catch (err) {
    options.onError(err instanceof Error ? err.message : 'Unable to start speech recognition.');
    options.onEnd();
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Ignored
      }
    },
  };
}

/** Clean markdown syntax before feeding text into TTS for clean pronunciation */
export function cleanMarkdownForTTS(text: string): string {
  if (!text) return '';
  return text
    .replace(/###\s+/g, '')
    .replace(/##\s+/g, '')
    .replace(/#\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[-*•]\s+/g, '')
    .replace(/---+/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stop any ongoing speech synthesis */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export interface SpeakOptions {
  speechLang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Read text aloud using browser SpeechSynthesis with matching language voice.
 */
export function speakText(text: string, options: SpeakOptions = {}): void {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.(new Error('Speech synthesis is not supported on this device.'));
    return;
  }

  stopSpeaking();

  const cleaned = cleanMarkdownForTTS(text);
  if (!cleaned) return;

  const utterance = new SpeechSynthesisUtterance(cleaned);
  const targetLang = options.speechLang || 'en-US';
  utterance.lang = targetLang;
  utterance.rate = options.rate ?? 0.95; // Slightly slower for clear medical terminology
  utterance.pitch = options.pitch ?? 1.0;

  // Attempt to select the best matching voice
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const matchingVoice =
      voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
  }

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    if (e.error !== 'canceled' && e.error !== 'interrupted') {
      options.onError?.(new Error(`Speech synthesis error: ${e.error}`));
    }
    options.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}
