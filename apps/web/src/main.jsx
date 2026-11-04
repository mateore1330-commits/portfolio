import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/rutas.jsx'
import '@/estilos/fuentes.css'
import '@/estilos/variables.css'
import '@/estilos/base.css'
import '@/estilos/movimiento.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
