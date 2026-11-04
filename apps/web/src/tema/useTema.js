import { useContext } from 'react'
import { ContextoTema } from '@/tema/ContextoTema.js'

// Devuelve { theme, setTheme }. theme es 'system', 'light' o 'dark'.
export function useTema() {
  const context = useContext(ContextoTema)
  if (!context) throw new Error('useTema necesita estar dentro de <ProveedorTema>')
  return context
}
