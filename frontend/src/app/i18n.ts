import i18next, { type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'

type Bundle = Record<string, unknown>

const bundles = import.meta.glob<{ default: Bundle }>('../features/*/locales/*.json', { eager: true })

export function createI18n(): i18n {
  const resources: Record<string, Record<string, Bundle>> = {}
  for (const [path, module] of Object.entries(bundles)) {
    const match = /features\/([^/]+)\/locales\/([^/]+)\.json$/.exec(path)
    if (!match) {
      continue
    }
    const namespace = match[1] ?? ''
    const locale = match[2] ?? ''
    resources[locale] ??= {}
    resources[locale][namespace] = module.default
  }
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    resources,
    interpolation: { escapeValue: false },
  })
  return instance
}
