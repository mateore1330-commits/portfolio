import { useState } from 'react'
import Dialogo from '@/panel/comun/Dialogo.jsx'

const plural = (n) => (n === 1 ? '1 campo' : `${n} campos`)
const OTRO = { español: 'inglés', inglés: 'español' }
const CODIGO = { español: 'es', inglés: 'en' }

// El primer campo por revisar que se ve (el de la pestaña recién elegida): a la vista y con
// el cursor dentro. Espera a que React pinte la pestaña nueva y a que el diálogo, al
// cerrarse, devuelva el foco al botón Guardar (si no, se lo quitaría al campo).
function irAlCampo() {
  setTimeout(() => {
    const campo = [...document.querySelectorAll('.por-revisar')].find((c) => c.offsetParent !== null)
    if (!campo) return
    campo.scrollIntoView({ behavior: 'smooth', block: 'center' })
    campo.querySelector('input, textarea')?.focus({ preventScroll: true })
  }, 120)
}

// Antes de guardar, si hay campos cambiados en un idioma y no en el otro (#185), pregunta:
// "Revisar" lleva a la pestaña que falta (alRevisar recibe su idioma y la primera clave),
// baja hasta el primer campo marcado en azul y deja el cursor en él; "Guardar igual" guarda
// (una errata se corrige en un solo idioma). Sin campos así, guarda directamente.
//   const { comprobar, dialogo } = useRevisarIdiomas(form, setIdioma)
//   <button onClick={comprobar(guardar)}>Guardar</button> … {dialogo}
export function useRevisarIdiomas(form, alRevisar) {
  const [pendiente, setPendiente] = useState(null) // { claves, porIdioma, guardar }

  const comprobar = (guardar) => () => {
    const claves = form.porRevisar()
    if (claves.length === 0) return guardar()
    // Cuántos se cambiaron en cada idioma sin tocar el otro.
    const porIdioma = {}
    for (const clave of claves) {
      const cambiado = form.revisar(clave)
      porIdioma[cambiado] = (porIdioma[cambiado] ?? 0) + 1
    }
    setPendiente({ claves, porIdioma, guardar })
  }

  const cerrar = () => setPendiente(null)
  const revisar = () => {
    const [primera] = pendiente.claves
    cerrar()
    alRevisar?.(CODIGO[OTRO[form.revisar(primera)]], primera)
    irAlCampo()
  }
  const guardarIgual = () => {
    const { guardar } = pendiente
    cerrar()
    guardar()
  }

  const dialogo = (
    <Dialogo abierto={Boolean(pendiente)} titulo="¿Guardar sin revisar la traducción?" alCerrar={cerrar}>
      {pendiente && (
        <>
          {Object.entries(pendiente.porIdioma).map(([cambiado, n]) => (
            <p key={cambiado}>
              Has cambiado {plural(n)} en {cambiado} sin tocar el {OTRO[cambiado]}. Están marcados en azul.
            </p>
          ))}
          <p>Si solo era una errata o un retoque, puedes guardar igual.</p>
          <div className="acciones">
            <button className="boton suave" type="button" onClick={guardarIgual}>
              Guardar igual
            </button>
            <button className="boton azul" type="button" data-enfoque onClick={revisar}>
              Revisar
            </button>
          </div>
        </>
      )}
    </Dialogo>
  )

  return { comprobar, dialogo }
}
