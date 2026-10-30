import { Outlet } from 'react-router'
import ContentProvider from '@/content/ContentProvider.jsx'
import ContribucionesProvider from '@/content/ContribucionesProvider.jsx'
import ThemeProvider from '@/theme/ThemeProvider.jsx'

// Layout común a todas las páginas: aquí irán la cabecera y el pie.
export default function App() {
  return (
    <ThemeProvider>
      <ContentProvider>
        <ContribucionesProvider>
          <Outlet />
        </ContribucionesProvider>
      </ContentProvider>
    </ThemeProvider>
  )
}
