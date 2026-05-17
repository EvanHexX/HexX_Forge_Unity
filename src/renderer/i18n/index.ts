import { en } from './locales/en';
import { ko } from './locales/ko';
import { zhCN } from './locales/zhCN';

export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', labelKey: 'settings.language.option.en' },
    { code: 'ko', labelKey: 'settings.language.option.ko' },
    { code: 'zh-CN', labelKey: 'settings.language.option.zh-CN' }
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
export type I18nKey = keyof typeof en;

const dictionaries: Record<LanguageCode, Record<I18nKey, string>> = {
    en,
    ko,
    'zh-CN': zhCN
};

export function isLanguageCode(value: unknown): value is LanguageCode {
    return typeof value === 'string' && SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

export function getSafeLanguage(value: unknown): LanguageCode {
    return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
}

export function t(key: I18nKey, language: unknown = DEFAULT_LANGUAGE): string {
    const safeLanguage = getSafeLanguage(language);
    return dictionaries[safeLanguage][key] ?? dictionaries[DEFAULT_LANGUAGE][key] ?? key;
}
