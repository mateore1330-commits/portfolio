import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { pedir } from '@/admin/api.js'
import { Banda, Cabecera, TarjetasCargando } from '@/admin/comun/Estados.jsx'
import { diaYHora, haceCuanto } from '@/admin/fechas.js'
import { RUTA_PANEL } from '@/admin/ruta.js'
import { Barras } from '@/admin/visitas/Visitas.jsx'
import { numero, total, variacion } from '@/admin/visitas/datos.js'
import { ponerTitulo } from '@/i18n/documento.js'

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// La pantalla 2 · Inicio de la maqueta: mensajes, visitas de la semana (ADM-10, de Umami),
// contenido y atajos.
export default function Inicio() {
  const { resumen, cargarResumen, publicar, abrirPublicar } = useOutletContext()
  const pendientes = publicar?.pendientes?.length ?? 0

  useEffect(() => {
    ponerTitulo('Inicio · Panel')
  }, [])

  return (
    <>
      <Cabecera titulo="Hola, Mateo" texto="Esto es lo que tienes entre manos." />
      {pendientes > 0 && (
        <Banda
          tipo="aviso"
          acciones={
            <button className="boton azul pequeno" type="button" onClick={abrirPublicar}>
              Publicar →
            </button>
          }
        >
          <b>{plural(pendientes, 'cambio sin publicar', 'cambios sin publicar')}.</b>{' '}
          {publicar.ultima
            ? `La web todavía muestra lo del ${diaYHora(publicar.ultima.fecha).replace(', ', ' a las ')}.`
            : 'La web todavía no tiene nada publicado desde el panel.'}
        </Banda>
      )}
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
              <li key={m.id}>
                <Link to={`${RUTA_PANEL}/mensajes?estado=todos&ver=${m.id}`}>
                  {m.nombre}
                  {m.asunto && ` · ${m.asunto}`}
                </Link>
                <small>{haceCuanto(m.fecha)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nota">Todavía no ha llegado ninguno.</p>
        )}
      </section>

      <TarjetaVisitas />

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

// Las visitas de la semana. Va aparte del resumen: si Umami no está o no responde, solo esta
// tarjeta lo dice y lo demás se ve igual.
function TarjetaVisitas() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    pedir('/stats?periodo=7d').then((r) => {
      if (!vivo) return
      if (r.ok) setDatos(r.datos)
      else setError(r.error)
    })
    return () => {
      vivo = false
    }
  }, [])

  let contenido
  if (error === 'sin_umami') contenido = <p className="nota">Aún no están configuradas: llegan con tu servidor (Umami).</p>
  else if (error) contenido = <p className="nota">Ahora no se pueden cargar (Umami no responde). El resto del panel funciona.</p>
  else if (!datos) contenido = <span className="hueco grande" aria-label="Cargando las visitas" />
  else {
    const { resumen, eventos } = datos
    const cambio = variacion(resumen.visitantes, resumen.antes.visitantes)
    contenido = (
      <>
        <p className="cifra">{numero(resumen.visitantes)}</p>
        <p>
          visitantes · {numero(resumen.paginas)} páginas vistas
          {cambio && (
            <>
              {' · '}
              <b className={cambio.startsWith('-') ? 'baja' : 'sube'}>{cambio}</b>
            </>
          )}
        </p>
        <Barras filas={datos.por_dia} alto="56px" />
        <ul>
          <li>
            CV descargados <small>{total(eventos, ['cv-descargado'])}</small>
          </li>
          <li>
            Formularios enviados <small>{total(eventos, ['formulario-enviado'])}</small>
          </li>
        </ul>
      </>
    )
  }

  return (
    <section className="tarjeta">
      <h2>
        Visitas · 7 días
        <Link className="enlace" to={`${RUTA_PANEL}/visitas`}>
          Ver más →
        </Link>
      </h2>
      {contenido}
    </section>
  )
}
