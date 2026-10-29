import { useEffect, useLayoutEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { actualizarAlternativas, restaurarAncla } from '@/i18n/documento.js'
import { leerGuardado } from '@/i18n/idiomas.js'
import { LanguageContext } from '@/i18n/LanguageContext.js'
import LanguageSwitch from '@/i18n/LanguageSwitch.jsx'
import { useLang, useT } from '@/i18n/useLang.js'
import '@/i18n/language-switch.css'

// El idioma lo decide la ruta: este layout lo recibe y lo reparte al resto.
export default function LanguageLayout({ lang }) {
  return (
    <LanguageContext.Provider value={lang}>
      <Documento />
      <LanguageSwitch />
      <Outlet />
    </LanguageContext.Provider>
  )
}

// Solo la primera página de la visita puede redirigir al idioma recordado.
let primeraPagina = true

function Documento() {
  const lang = useLang()
  const t = useT()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Si la última vez se eligió inglés y se entra en la portada, se va a /en.
  // Nunca desde otra ruta: un enlace compartido a la versión española se respeta.
  useEffect(() => {
    const esPrimera = primeraPagina
    primeraPagina = false
    if (esPrimera && pathname === '/' && leerGuardado() === 'en') {
      navigate('/en', { replace: true })
    }
  }, [pathname, navigate])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('meta.titulo')
    actualizarAlternativas(pathname)
  }, [lang, t, pathname])

  // Antes de pintar: si venimos del selector, volver a la sección que se estaba viendo.
  useLayoutEffect(() => {
    restaurarAncla()
  }, [lang])

  return null
}
