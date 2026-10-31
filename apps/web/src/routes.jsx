import { createBrowserRouter } from 'react-router'
import App from '@/App.jsx'
import LanguageLayout from '@/i18n/LanguageLayout.jsx'
import Home from '@/pages/Home.jsx'
import LegalPage from '@/pages/LegalPage.jsx'
import NotFound from '@/pages/NotFound.jsx'
import ProjectPage from '@/pages/ProjectPage.jsx'

// /_design solo existe en desarrollo: en el build, import.meta.env.DEV es
// false y la página ni siquiera se incluye en el bundle.
const devRoutes = import.meta.env.DEV
  ? [{ path: '_design', lazy: async () => ({ Component: (await import('@/pages/Design.jsx')).default }) }]
  : []

// Las mismas páginas en cada idioma. Lo que no existe cae en la 404 de su idioma.
const paginas = (lang) => ({
  element: <LanguageLayout lang={lang} />,
  children: [
    { index: true, element: <Home /> },
    { path: 'proyectos/:slug', element: <ProjectPage /> },
    { path: 'aviso-legal', element: <LegalPage clave="aviso" /> },
    { path: 'privacidad', element: <LegalPage clave="privacidad" /> },
    { path: '*', element: <NotFound /> },
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
