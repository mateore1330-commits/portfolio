import { createBrowserRouter } from 'react-router'
import App from '@/App.jsx'
import Home from '@/pages/Home.jsx'

// /_design solo existe en desarrollo: en el build, import.meta.env.DEV es
// false y la página ni siquiera se incluye en el bundle.
const devRoutes = import.meta.env.DEV
  ? [{ path: '_design', lazy: async () => ({ Component: (await import('@/pages/Design.jsx')).default }) }]
  : []

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    // Lo que se pinta mientras llega una página diferida (lazy) al entrar
    // directamente en ella. Tarda milisegundos: no merece un cargador.
    HydrateFallback: () => null,
    children: [{ index: true, element: <Home /> }, ...devRoutes],
  },
])
