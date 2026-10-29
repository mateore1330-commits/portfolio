import { Outlet } from 'react-router'
import ThemeProvider from '@/theme/ThemeProvider.jsx'

// Layout común a todas las páginas: aquí irán la cabecera y el pie.
export default function App() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  )
}
