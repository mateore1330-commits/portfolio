import { useEffect } from 'react'
import { Link, useOutletContext } from 'react-router'
import { Banda, Cabecera, TarjetasCargando } from '@/admin/comun/Estados.jsx'
import { diaYHora, haceCuanto } from '@/admin/fechas.js'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { ponerTitulo } from '@/i18n/documento.js'

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// La pantalla 2 · Inicio de la maqueta, con lo que ya funciona de verdad. Las visitas
// llegan con ADM-10 y Publicar con ADM-05, cada uno en su sitio.
export default function Inicio() {
  const { resumen, cargarResumen } = useOutletContext()

  useEffect(() => {
    ponerTitulo('Inicio · Panel')
  }, [])

  return (
    <>
      <Cabecera titulo="Hola, Mateo" texto="Esto es lo que tienes entre manos." />
      {!resumen && <TarjetasCargando />}
      {resumen?.error && (
        <Banda
          tipo="error"
          acciones={
            <button className="boton suave pequeno" type="button" onClick={cargarResumen}>
              Reintentar
            </button>
          }
        >
          <b>No se ha podido cargar el resumen.</b> El resto del panel funciona.
        </Banda>
      )}
      {resumen && !resumen.error && <Tarjetas resumen={resumen} />}
    </>
  )
}

function Tarjetas({ resumen: { mensajes, contenido, ultima_publicacion: ultima } }) {
  const { proyectos, empleos, formacion } = contenido
  const ocultos = empleos.ocultos + formacion.ocultos

  return (
    <div className="rejilla">
      <section className="tarjeta">
        <h2>
          Mensajes
          <Link className="enlace" to={`${RUTA_PANEL}/mensajes`}>
            Ver todos →
          </Link>
        </h2>
        <p className="cifra">{mensajes.sin_leer}</p>
        <p>sin leer</p>
        {mensajes.ultimos.length > 0 ? (
          <ul>
            {mensajes.ultimos.map((m) => (
              <li key={m.fecha}>
                <span>
                  {m.nombre}
                  {m.asunto && ` · ${m.asunto}`}
                </span>
                <small>{haceCuanto(m.fecha)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nota">Todavía no ha llegado ninguno.</p>
        )}
      </section>

      <section className="tarjeta">
        <h2>Contenido</h2>
        <ul>
          <li>
            Proyectos <small>{`${proyectos.publicados} publicados · ${plural(proyectos.borradores, 'borrador', 'borradores')}`}</small>
          </li>
          <li>
            Trayectoria{' '}
            <small>
              {`${plural(empleos.visibles, 'empleo', 'empleos')} · ${plural(formacion.visibles, 'formación', 'formaciones')}`}
              {ocultos > 0 && ` · ${plural(ocultos, 'oculto', 'ocultos')}`}
            </small>
          </li>
          <li>
            Conocimientos <small>{contenido.conocimientos} en la web</small>
          </li>
          <li>
            Última publicación <small>{ultima ? diaYHora(ultima) : 'nunca'}</small>
          </li>
        </ul>
      </section>

      <section className="tarjeta">
        <h2>Atajos</h2>
        <ul>
          <li>
            <Link className="enlace" to={`${RUTA_PANEL}/proyectos`}>
              + Nuevo proyecto
            </Link>
          </li>
          <li>
            <Link className="enlace" to={`${RUTA_PANEL}/textos`}>
              Editar los textos
            </Link>
          </li>
          <li>
            <Link className="enlace" to={`${RUTA_PANEL}/cv`}>
              Generar el CV
            </Link>
          </li>
          <li>
            <a className="enlace" href="/" target="_blank" rel="noopener">
              Ver la web ↗
            </a>
          </li>
        </ul>
      </section>
    </div>
  )
}
