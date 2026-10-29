import { useCallback, useContext } from 'react'
import en from '@/i18n/en.json'
import es from '@/i18n/es.json'
import { otro, pick } from '@/i18n/idiomas.js'
import { LanguageContext } from '@/i18n/LanguageContext.js'

const TEXTOS = { es, en }

// 'es' o 'en', según la ruta.
export function useLang() {
  return useContext(LanguageContext)
}

// t('error.titulo') → el texto de interfaz en el idioma actual, o en el otro si falta.
export function useT() {
  const lang = useLang()
  return useCallback(
    (clave) => {
      const texto = TEXTOS[lang][clave] ?? TEXTOS[otro(lang)][clave]
      if (texto !== undefined) return texto
      if (import.meta.env.DEV) console.warn(`[i18n] Falta el texto "${clave}" en los dos idiomas.`)
      return clave
    },
    [lang],
  )
}

// p(campo) → el campo de contenido en el idioma actual.
export function usePick() {
  const lang = useLang()
  return useCallback((campo) => pick(campo, lang), [lang])
}
