import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['de'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/features/{{namespace}}/locales/{{language}}.json',
    defaultNS: 'lists',
    nsSeparator: ':',
    keySeparator: '.',
    primaryLanguage: 'de',
    removeUnusedKeys: true,
    sort: true,
    indentation: 2,
    defaultValue: '',
  },
})
