import { createBrowserRouter } from 'react-router'
import App from '@/App.jsx'
import LanguageLayout from '@/i18n/LanguageLayout.jsx'
import Home from '@/pages/Home.jsx'
import { RUTA_PANEL } from '@/admin/ruta.js'

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

// El panel (ADM-01 en adelante): fuera de la web pública y solo si su dirección está
// configurada (VITE_ADMIN_PATH). Todo su código se carga al entrar en él: la web no lo lleva
// encima. Todo menos entrar pasa por el portero (RutaProtegida). Las secciones que aún no
// existen caen en :seccion ("Llega en…"); cada issue pone la suya delante.
const delPanel = (cargar, nombre = 'default') => async () => ({ Component: (await cargar())[nombre] })
const panel = RUTA_PANEL
  ? [{
      path: RUTA_PANEL,
      lazy: delPanel(() => import('@/admin/PanelRaiz.jsx')),
      HydrateFallback: () => null,
      children: [
        { path: 'entrar', lazy: delPanel(() => import('@/admin/Entrar.jsx')) },
        // La vista previa, en su pestaña y sin el panel alrededor (la sesión la pide la API).
        { path: 'proyectos/:id/vista-previa', lazy: delPanel(() => import('@/admin/proyectos/VistaPrevia.jsx')) },
        {
          lazy: delPanel(() => import('@/admin/RutaProtegida.jsx')),
          children: [
            { index: true, lazy: delPanel(() => import('@/admin/Inicio.jsx')) },
            { path: 'proyectos', lazy: delPanel(() => import('@/admin/proyectos/Proyectos.jsx')) },
            { path: 'proyectos/nuevo', lazy: delPanel(() => import('@/admin/proyectos/Proyecto.jsx')) },
            { path: 'proyectos/:id', lazy: delPanel(() => import('@/admin/proyectos/Proyecto.jsx')) },
            { path: ':seccion', lazy: delPanel(() => import('@/admin/Proximamente.jsx')) },
            { path: '*', lazy: delPanel(() => import('@/admin/Proximamente.jsx'), 'NoEncontrado') },
          ],
        },
      ],
    }]
  : []

export const router = createBrowserRouter([
  ...panel,
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
