import { useContext } from 'react'
import { ThemeContext } from '@/theme/ThemeContext.js'

// Devuelve { theme, setTheme }. theme es 'system', 'light' o 'dark'.
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme necesita estar dentro de <ThemeProvider>')
  return context
}
