import { createBrowserRouter } from 'react-router'
import Aplicacion from '@/Aplicacion.jsx'
import ErrorRuta from '@/compartido/componentes/ErrorRuta.jsx'
import EstructuraWeb from '@/web/estructura/EstructuraWeb.jsx'
import Portada from '@/web/paginas/Portada.jsx'
import { RUTA_PANEL } from '@/panel/utilidades/ruta.js'

// /_design solo existe en desarrollo: en el build, import.meta.env.DEV es
// false y la página ni siquiera se incluye en el bundle.
const devRoutes = import.meta.env.DEV
  ? [{ path: '_design', lazy: async () => ({ Component: (await import('@/web/paginas/Diseno.jsx')).default }) }]
  : []

// Las páginas que no son la portada se cargan al entrar en ellas (lazy): así su código no
// viaja con la portada, que es la que más se visita y la que mide Lighthouse en móvil.
const proyecto = async () => ({ Component: (await import('@/web/paginas/PaginaProyecto.jsx')).default })
const legal = (clave) => async () => {
  const { default: PaginaLegal } = await import('@/web/paginas/PaginaLegal.jsx')
  return { element: <PaginaLegal clave={clave} /> }
}
const noExiste = async () => ({ Component: (await import('@/web/paginas/NoEncontrada.jsx')).default })

// Las mismas páginas en cada idioma. Lo que no existe cae en la 404 de su idioma.
const paginas = (lang) => ({
  element: <EstructuraWeb lang={lang} />,
  children: [
    { index: true, element: <Portada /> },
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
      lazy: delPanel(() => import('@/panel/PanelRaiz.jsx')),
      HydrateFallback: () => null,
      errorElement: <ErrorRuta />,
      children: [
        { path: 'entrar', lazy: delPanel(() => import('@/panel/entrar/Entrar.jsx')) },
        // Las vistas previas, en su pestaña y sin el panel alrededor (la sesión la pide la API).
        { path: 'proyectos/:id/vista-previa', lazy: delPanel(() => import('@/panel/proyectos/VistaPrevia.jsx')) },
        { path: 'textos/vista-previa', lazy: delPanel(() => import('@/panel/textos/VistaPreviaTextos.jsx')) },
        { path: 'trayectoria/empleo/:id/vista-previa', lazy: delPanel(() => import('@/panel/trayectoria/VistaPreviaTrayectoria.jsx'), 'VistaPreviaEmpleo') },
        { path: 'trayectoria/formacion/:id/vista-previa', lazy: delPanel(() => import('@/panel/trayectoria/VistaPreviaTrayectoria.jsx'), 'VistaPreviaFormacion') },
        {
          lazy: delPanel(() => import('@/panel/RutaProtegida.jsx')),
          children: [
            { index: true, lazy: delPanel(() => import('@/panel/inicio/Inicio.jsx')) },
            { path: 'proyectos', lazy: delPanel(() => import('@/panel/proyectos/Proyectos.jsx')) },
            { path: 'proyectos/nuevo', lazy: delPanel(() => import('@/panel/proyectos/Proyecto.jsx')) },
            { path: 'proyectos/:id', lazy: delPanel(() => import('@/panel/proyectos/Proyecto.jsx')) },
            { path: 'proyectos/:id/imagenes', lazy: delPanel(() => import('@/panel/proyectos/Imagenes.jsx')) },
            { path: 'textos', lazy: delPanel(() => import('@/panel/textos/Textos.jsx')) },
            { path: 'cv', lazy: delPanel(() => import('@/panel/cv/CV.jsx')) },
            { path: 'publicaciones', lazy: delPanel(() => import('@/panel/publicar/Publicaciones.jsx')) },
            { path: 'trayectoria', lazy: delPanel(() => import('@/panel/trayectoria/Trayectoria.jsx')) },
            { path: 'conocimientos', lazy: delPanel(() => import('@/panel/conocimientos/Conocimientos.jsx')) },
            { path: 'mensajes', lazy: delPanel(() => import('@/panel/mensajes/Mensajes.jsx')) },
            { path: 'visitas', lazy: delPanel(() => import('@/panel/visitas/Visitas.jsx')) },
            { path: 'trayectoria/empleo/nuevo', lazy: delPanel(() => import('@/panel/trayectoria/Entrada.jsx'), 'Empleo') },
            { path: 'trayectoria/empleo/:id', lazy: delPanel(() => import('@/panel/trayectoria/Entrada.jsx'), 'Empleo') },
            { path: 'trayectoria/formacion/nuevo', lazy: delPanel(() => import('@/panel/trayectoria/Entrada.jsx'), 'Formacion') },
            { path: 'trayectoria/formacion/:id', lazy: delPanel(() => import('@/panel/trayectoria/Entrada.jsx'), 'Formacion') },
            { path: ':seccion', lazy: delPanel(() => import('@/panel/Proximamente.jsx')) },
            { path: '*', lazy: delPanel(() => import('@/panel/Proximamente.jsx'), 'NoEncontrado') },
          ],
        },
      ],
    }]
  : []

export const router = createBrowserRouter([
  ...panel,
  {
    path: '/',
    element: <Aplicacion />,
    // Lo que se pinta mientras llega una página diferida (lazy) al entrar
    // directamente en ella. Tarda milisegundos: no merece un cargador.
    HydrateFallback: () => null,
    // Si una página falla (o es de una versión anterior): ErrorRuta, no la pantalla de React Router.
    errorElement: <ErrorRuta />,
    children: [
      ...devRoutes,
      { path: 'en', ...paginas('en') },
      paginas('es'),
    ],
  },
])
