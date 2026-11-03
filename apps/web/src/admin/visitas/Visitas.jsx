import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import {
  EVENTOS,
  PERIODOS,
  desglose,
  fecha,
  juntarDispositivos,
  minutos,
  numero,
  pais,
  total,
  variacion,
} from '@/admin/visitas/datos.js'
import { ponerTitulo } from '@/i18n/documento.js'
import { URL_PANEL_UMAMI, esteNavegadorNoCuenta, noMedirEsteNavegador, volverAMedirEsteNavegador } from '@/medir.js'

// 13 · Visitas (aprobada en ADM-00): lo que cuenta Umami, que está en nuestro servidor
// (ADM-10). El panel se lo pide a la API, y la API a Umami: aquí nunca hay credenciales.
// El periodo va en la dirección (?periodo=7d). Si Umami no está o no responde, se dice y
// el resto del panel sigue funcionando.
export default function Visitas() {
  const [params, setParams] = useSearchParams()
  const periodo = PERIODOS.find((p) => p.id === params.get('periodo')) ?? PERIODOS[1]
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [proyectos, setProyectos] = useState({}) // { slug: nombre }, para el desglose

  useEffect(() => {
    ponerTitulo('Visitas · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    pedir(`/stats?periodo=${periodo.id}`).then((r) => {
      if (!vivo) return
      if (r.ok) {
        setDatos(r.datos)
        setError(null)
      } else setError(r.error)
    })
    return () => {
      vivo = false
    }
  }, [periodo.id, intento])

  useEffect(() => {
    pedir('/projects').then((r) => r.ok && setProyectos(Object.fromEntries(r.datos.map((p) => [p.slug, p.name.es || p.slug]))))
  }, [])

  const reintentar = useCallback(() => {
    setDatos(null)
    setError(null)
    setIntento((n) => n + 1)
  }, [])

  const cambiarPeriodo = (id) => {
    setDatos(null)
    setError(null)
    setParams(id === '30d' ? {} : { periodo: id }, { replace: true })
  }

  const cabecera = (
    <Cabecera
      titulo="Visitas"
      texto={
        <>
          Quién entra, de dónde viene y qué hace. Medido con <b>Umami, sin cookies</b>: no se guarda nada en el dispositivo de nadie, y
          tus visitas no cuentan.
        </>
      }
    >
      <div className="segmento" role="group" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" aria-pressed={p.id === periodo.id} onClick={() => cambiarPeriodo(p.id)}>
            {p.nombre}
          </button>
        ))}
      </div>
      {URL_PANEL_UMAMI && (
        <a className="boton suave" href={URL_PANEL_UMAMI} target="_blank" rel="noopener noreferrer">
          Análisis completo en Umami ↗
        </a>
      )}
    </Cabecera>
  )

  let cuerpo
  if (error === 'sin_umami') {
    cuerpo = (
      <Banda tipo="info">
        <b>Las visitas aún no están configuradas.</b> Umami se instala en tu servidor con INFRA-03; cuando esté y su usuario esté en el
        .env de la API, aquí verás quién entra en tu web. Mientras tanto no se pierde nada: la web aún no está publicada.
      </Banda>
    )
  } else if (error) {
    cuerpo = (
      <Banda
        tipo="error"
        acciones={
          <button className="boton pequeno" type="button" onClick={reintentar}>
            Reintentar
          </button>
        }
      >
        <b>Ahora no se pueden cargar las visitas:</b> {error === 'red' ? 'no hay conexión con la API.' : 'Umami no responde.'} Vuelve a
        intentarlo en un rato; los datos no se pierden.
      </Banda>
    )
  } else if (!datos) {
    cuerpo = (
      <div className="filas-cargando" aria-busy="true" aria-label="Cargando las visitas">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <span className="hueco grande" />
            <span className="hueco" />
            <span className="hueco corto" />
          </div>
        ))}
      </div>
    )
  } else if (datos.resumen.visitantes === 0) {
    cuerpo = (
      <Vacio icono="◌" titulo="Todavía no hay visitas en este periodo">
        <p>Cuando alguien entre en tu web, aparecerá aquí.</p>
      </Vacio>
    )
  } else {
    cuerpo = <Cifras datos={datos} periodo={periodo} proyectos={proyectos} />
  }

  return (
    <>
      {cabecera}
      {cuerpo}
      <MiNavegador />
    </>
  )
}

function Cifras({ datos, periodo, proyectos }) {
  const { resumen, por_dia: porDia, eventos } = datos
  const cambio = variacion(resumen.visitantes, resumen.antes.visitantes)
  const filas = EVENTOS.map((e) => ({ nombre: e.nombre, total: total(eventos, e.eventos), detalle: desglose(eventos, e.eventos, proyectos) }))
  const paises = datos.paises.map((p) => ({ nombre: pais(p.nombre), total: p.total }))

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Visitantes</h2>
          <p className="cifra">{numero(resumen.visitantes)}</p>
          <p>
            {cambio ? (
              <>
                <b className={cambio.startsWith('-') ? 'baja' : 'sube'}>{cambio}</b> que {periodo.anteriores}
              </>
            ) : (
              `Sin datos de ${periodo.anteriores}`
            )}
          </p>
        </section>
        <section className="tarjeta">
          <h2>Páginas vistas</h2>
          <p className="cifra">{numero(resumen.paginas)}</p>
          <p>{(resumen.paginas / resumen.visitantes).toLocaleString('es-ES', { maximumFractionDigits: 1 })} por visitante</p>
        </section>
        <section className="tarjeta">
          <h2>Tiempo en la web</h2>
          <p className="cifra">{minutos(resumen.visitas ? resumen.tiempo / resumen.visitas : 0)}</p>
          <p>de media por visita</p>
        </section>
        <section className="tarjeta destacada">
          <h2>Te han escrito</h2>
          <p className="cifra">{total(eventos, ['formulario-enviado'])}</p>
          <p>
            formularios · <b>{total(eventos, ['cv-descargado'])} CV descargados</b>
          </p>
        </section>
      </div>

      <section className="tarjeta separada">
        <h2>
          {periodo.id === '12m' ? 'Por mes' : 'Por día'}{' '}
          <span className="leyenda mono">
            <b className="v">■</b> visitantes · <b className="p">■</b> páginas vistas
          </span>
        </h2>
        <Barras filas={porDia} />
      </section>

      <section className="tarjeta separada">
        <h2>Lo que hacen · eventos</h2>
        <ListaCifras filas={filas} />
      </section>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>De dónde vienen</h2>
          <ListaCifras filas={datos.procedencias} />
        </section>
        <section className="tarjeta">
          <h2>Países</h2>
          {paises.length > 0 ? <ListaCifras filas={paises} /> : <p className="nota">Sin datos todavía.</p>}
        </section>
        <section className="tarjeta">
          <h2>Dispositivos</h2>
          <ListaCifras filas={juntarDispositivos(datos.dispositivos)} />
        </section>
      </div>

      <section className="tarjeta separada">
        <h2>Páginas más vistas</h2>
        <ListaCifras filas={datos.paginas} />
      </section>
    </>
  )
}

// La gráfica de la maqueta: una barra por día (o mes), páginas vistas detrás y visitantes
// delante. Para el lector de pantalla, un resumen en texto.
export function Barras({ filas, alto }) {
  const maximo = Math.max(1, ...filas.map((f) => f.paginas))
  const pico = filas.reduce((a, b) => (b.visitantes > a.visitantes ? b : a), filas[0])
  const marcas = [filas[0], filas[Math.floor(filas.length / 2)], filas[filas.length - 1]]
  const resumen = `Del ${fecha(filas[0].fecha)} al ${fecha(filas.at(-1).fecha)}. Más visitantes: ${pico.visitantes}, el ${fecha(pico.fecha)}.`
  return (
    <>
      <div className="barras dobles" role="img" aria-label={resumen} style={alto ? { height: alto } : undefined}>
        {filas.map((f) => (
          <span key={f.fecha} title={`${fecha(f.fecha)}: ${f.visitantes} visitantes · ${f.paginas} páginas`}>
            <i className="pv" style={{ height: `${(f.paginas / maximo) * 100}%` }} />
            <i style={{ height: `${(f.visitantes / maximo) * 100}%` }} />
          </span>
        ))}
      </div>
      {!alto && (
        <div className="eje" aria-hidden="true">
          {marcas.map((m, i) => (
            <span key={i}>{fecha(m.fecha)}</span>
          ))}
        </div>
      )}
    </>
  )
}

function ListaCifras({ filas }) {
  const maximo = Math.max(1, ...filas.map((f) => f.total))
  return (
    <ul className="lista-cifras">
      {filas.map((f) => (
        <li key={f.nombre}>
          <span>
            {f.nombre} {f.detalle && <small>{f.detalle}</small>}
          </span>
          <b className="mono">{numero(f.total)}</b>
          <div className="progreso" aria-hidden="true">
            <i style={{ width: `${(f.total / maximo) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Tus visitas no cuentan: al entrar al panel, este navegador queda marcado. Aquí se ve y
// se puede cambiar (por ejemplo, para probar que la medición funciona).
function MiNavegador() {
  const [noCuenta, setNoCuenta] = useState(esteNavegadorNoCuenta)
  const cambiar = () => {
    if (noCuenta) volverAMedirEsteNavegador()
    else noMedirEsteNavegador()
    setNoCuenta(!noCuenta)
  }
  return (
    <p className="nota-navegador mono">
      {noCuenta ? 'Tus visitas desde este navegador no cuentan.' : 'Tus visitas desde este navegador sí cuentan.'}{' '}
      <button className="enlace" type="button" onClick={cambiar}>
        {noCuenta ? 'Volver a contarlas' : 'Dejar de contarlas'}
      </button>
    </p>
  )
}
