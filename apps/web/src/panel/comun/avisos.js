import { createContext, useContext } from 'react'

export const AvisosContext = createContext(() => {})

// avisar('ok', 'Guardado. Se verá en la web al publicar.') · avisar('error', '…')
export function useAvisar() {
  return useContext(AvisosContext)
}
