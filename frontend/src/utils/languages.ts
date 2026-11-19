import type { SupportedLanguage } from '../types';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    speechCode: 'en-US',
    flag: '🌐',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    speechCode: 'hi-IN',
    flag: '🇮🇳',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    speechCode: 'ta-IN',
    flag: '🇮🇳',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    speechCode: 'te-IN',
    flag: '🇮🇳',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    speechCode: 'kn-IN',
    flag: '🇮🇳',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    speechCode: 'ml-IN',
    flag: '🇮🇳',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    speechCode: 'mr-IN',
    flag: '🇮🇳',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    speechCode: 'bn-IN',
    flag: '🇮🇳',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    speechCode: 'es-ES',
    flag: '🇪🇸',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    speechCode: 'fr-FR',
    flag: '🇫🇷',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    speechCode: 'de-DE',
    flag: '🇩🇪',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    speechCode: 'ar-SA',
    flag: '🇸🇦',
  },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = SUPPORTED_LANGUAGES[0];

export function getLanguageByCode(code: string): SupportedLanguage {
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === (code || 'en').toLowerCase()
  );
  return match || DEFAULT_LANGUAGE;
}

export const LANGUAGE_PLACEHOLDERS: Record<string, string> = {
  en: 'Describe your symptoms or ask a health question... (Shift+Enter for new line)',
  hi: 'अपने लक्षणों का वर्णन करें या स्वास्थ्य संबंधी प्रश्न पूछें...',
  ta: 'உங்கள் அறிகுறிகளை விவரிக்கவும் அல்லது கேள்விகளைக் கேட்கவும்...',
  te: 'మీ లక్షణాలను వివరించండి లేదా ఆరోగ్య ప్రశ్న అడగండి...',
  kn: 'ನಿಮ್ಮ ಲಕ್ಷಣಗಳನ್ನು ವಿವರಿಸಿ ಅಥವಾ ಆರೋಗ್ಯ ಪ್ರಶ್ನೆ ಕೇಳಿ...',
  ml: 'നിങ്ങളുടെ ലക്ഷണങ്ങൾ വിവരിക്കുക അല്ലെങ്കിൽ ആരോഗ്യ ചോദ്യം ചോദിക്കുക...',
  mr: 'तुमची लक्षणे सांगा किंवा आरोग्याबद्दल प्रश्न विचारा...',
  bn: 'আপনার লক্ষণগুলি বর্ণনা করুন বা স্বাস্থ্য সম্পর্কিত প্রশ্ন জিজ্ঞাসা করুন...',
  es: 'Describe tus síntomas o haz una pregunta de salud...',
  fr: 'Décrivez vos symptômes ou posez une question de santé...',
  de: 'Beschreiben Sie Ihre Symptome oder stellen Sie eine Frage...',
  ar: 'اوصف أعراضك أو اطرح سؤالاً صحياً...',
};
