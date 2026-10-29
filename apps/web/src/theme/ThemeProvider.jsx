import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from '@/theme/ThemeContext.js'

// La misma clave y los mismos valores que el script de index.html.
const STORAGE_KEY = 'theme'
const EXPLICIT = ['light', 'dark']

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return EXPLICIT.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStored)

  useEffect(() => {
    const root = document.documentElement
    // "system" no escribe nada: sin data-theme, manda prefers-color-scheme.
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme

    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Sin almacenamiento (ventana privada, cookies bloqueadas): la
      // elección dura solo esta visita.
    }
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
