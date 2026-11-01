import { useEffect } from 'react'
import { Outlet } from 'react-router'
import ThemeProvider from '@/theme/ThemeProvider.jsx'

// La raíz de todas las páginas del panel: fuera de la web pública (sin su cabecera, su pie
// ni sus idiomas) y marcadas noindex para los buscadores. Su dirección no está en el
// robots.txt: nombrarla sería señalar dónde está la puerta. El modo claro/oscuro es el
// mismo que el de la web (ThemeProvider): lo que eliges en uno vale para los dos.
export default function PanelRaiz() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => meta.remove()
  }, [])
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  )
}
