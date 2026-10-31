import { createBrowserRouter } from 'react-router'
import App from '@/App.jsx'
import LanguageLayout from '@/i18n/LanguageLayout.jsx'
import Home from '@/pages/Home.jsx'

// /_design solo existe en desarrollo: en el build, import.meta.env.DEV es
// false y la página ni siquiera se incluye en el bundle.
const devRoutes = import.meta.env.DEV
  ? [{ path: '_design', lazy: async () => ({ Component: (await import('@/pages/Design.jsx')).default }) }]
  : []

// Las páginas que no son la portada se cargan al entrar en ellas (lazy): así su código no
// viaja con la portada, que es la que más se visita y la que mide Lighthouse en móvil.
const proyecto = async () => ({ Component: (await import('@/pages/ProjectPage.jsx')).default })
const legal = (clave) => async () => {
  const { default: LegalPage } = await import('@/pages/LegalPage.jsx')
  return { element: <LegalPage clave={clave} /> }
}
const noExiste = async () => ({ Component: (await import('@/pages/NotFound.jsx')).default })

// Las mismas páginas en cada idioma. Lo que no existe cae en la 404 de su idioma.
const paginas = (lang) => ({
  element: <LanguageLayout lang={lang} />,
  children: [
    { index: true, element: <Home /> },
    { path: 'proyectos/:slug', lazy: proyecto },
    { path: 'aviso-legal', lazy: legal('aviso') },
    { path: 'privacidad', lazy: legal('privacidad') },
    { path: '*', lazy: noExiste },
  ],
})

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    // Lo que se pinta mientras llega una página diferida (lazy) al entrar
    // directamente en ella. Tarda milisegundos: no merece un cargador.
    HydrateFallback: () => null,
    children: [
      ...devRoutes,
      { path: 'en', ...paginas('en') },
      paginas('es'),
    ],
  },
])
