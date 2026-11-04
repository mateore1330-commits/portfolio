import { diaYHora } from '@/panel/utilidades/fechas.js'

// La línea de estado y el botón Publicar de la barra de arriba (ADM-00): en todas las
// pantallas. estado: lo que da GET /publicar ({ pendientes, ultima }), null mientras llega.
export default function BarraPublicar({ estado, alPublicar }) {
  if (!estado || estado.error) return null
  const n = estado.pendientes.length
  const ultima = estado.ultima ? diaYHora(estado.ultima.fecha) : null
  return (
    <>
      {n > 0 ? (
        <p className="estado">
          <i className="dot" aria-hidden="true" />
          {n === 1 ? '1 cambio sin publicar' : `${n} cambios sin publicar`}
          {ultima && ` · última: ${ultima}`}
        </p>
      ) : (
        <p className="estado al-dia">
          <i className="dot" aria-hidden="true" />
          Todo publicado{ultima && ` · ${ultima}`}
        </p>
      )}
      <button className="boton azul pequeno" type="button" onClick={alPublicar} disabled={n === 0}>
        Publicar →
      </button>
    </>
  )
}
