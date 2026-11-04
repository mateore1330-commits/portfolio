import { useCallback, useContext } from 'react'
import en from '@/idioma/en.json'
import es from '@/idioma/es.json'
import { otro, pick } from '@/idioma/idiomas.js'
import { ContextoIdioma } from '@/idioma/ContextoIdioma.js'

const TEXTOS = { es, en }

// 'es' o 'en', según la ruta.
export function useIdioma() {
  return useContext(ContextoIdioma)
}

// t('error.titulo') → el texto de interfaz en el idioma actual, o en el otro si falta.
export function useT() {
  const lang = useIdioma()
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
export function useElegir() {
  const lang = useIdioma()
  return useCallback((campo) => pick(campo, lang), [lang])
}
