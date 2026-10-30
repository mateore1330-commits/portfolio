import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatoNumero } from '@/i18n/idiomas.js'
import { useLang, useT } from '@/i18n/useLang.js'

const SEMANAS = 53
const UN_DIA = 86_400_000
// Un lunes cualquiera: de él salen los nombres cortos de los días de la semana.
const LUNES = Date.UTC(2024, 0, 1)
// Las flechas: a los lados se salta una semana (columna); arriba y abajo, un día (fila).
const PASOS = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }

// Las fechas de GitHub son días sueltos ("2026-03-12"): se leen y se escriben en UTC
// para que la zona horaria del visitante no las mueva un día.
const leerFecha = (iso) => new Date(`${iso}T00:00:00Z`)

// Rejilla de 53 semanas × 7 días (de lunes a domingo), como la de GitHub con los azules
// de la identidad. Un cuadro marcado (con el ratón o con las flechas) muestra su fecha y
// su número. Con teclado, la rejilla es una sola parada de Tab y se recorre con las
// flechas; el lector de pantalla anuncia cada día.
export default function ContributionGrid({ semanas, total }) {
  const lang = useLang()
  const t = useT()
  const caja = useRef(null)
  const globo = useRef(null)
  const [activo, setActivo] = useState(null) // índice del cuadro marcado, o null
  const [conTeclado, setConTeclado] = useState(false)

  const celdas = useMemo(() => semanas.flat(), [semanas])
  const primero = useMemo(() => celdas.findIndex(Boolean), [celdas])
  const ultimo = useMemo(() => celdas.findLastIndex(Boolean), [celdas])

  const formatos = useMemo(
    () => ({
      fecha: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
      mes: new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }),
      dia: new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'UTC' }),
    }),
    [lang],
  )

  // El mes, encima de la semana en que empieza. Como en la maqueta: nunca a menos de 4
  // columnas del anterior ni en las 2 últimas, donde no cabría. El mes de la primera
  // columna no se pone: casi siempre es el final de un mes y taparía al siguiente.
  const meses = useMemo(() => {
    const lista = []
    const primerDia = semanas[0].find(Boolean)
    let anterior = primerDia ? leerFecha(primerDia.fecha).getUTCMonth() : null
    let ultimaColumna = -SEMANAS
    semanas.forEach((semana, columna) => {
      const dia = semana.find(Boolean)
      if (!dia) return
      const fecha = leerFecha(dia.fecha)
      const mes = fecha.getUTCMonth()
      if (mes !== anterior && columna - ultimaColumna >= 4 && columna <= SEMANAS - 3) {
        lista.push({ columna, texto: formatos.mes.format(fecha) })
        ultimaColumna = columna
      }
      anterior = mes
    })
    return lista
  }, [semanas, formatos])

  // L, X, V y D (o M, W, F y S): uno sí y uno no, como la maqueta.
  const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => (i % 2 === 0 ? formatos.dia.format(LUNES + i * UN_DIA) : ''))

  const describir = (celda) => {
    const numero = formatoNumero(lang).format(celda.n)
    const cuantas =
      celda.n === 0 ? t('actividad.ninguna') : celda.n === 1 ? t('actividad.una') : t('actividad.varias').replace('{n}', numero)
    return { cuantas, cuando: formatos.fecha.format(leerFecha(celda.fecha)) }
  }
  const marcada = activo !== null ? celdas[activo] : null
  const detalle = marcada && describir(marcada)

  // En pantallas estrechas la rejilla no cabe: se empieza mostrando lo más reciente (a la
  // derecha), que es lo que interesa, como hace GitHub en el móvil.
  const desplazable = useRef(null)
  useLayoutEffect(() => {
    desplazable.current.scrollLeft = desplazable.current.scrollWidth
  }, [semanas])

  // El globo se coloca encima del cuadro marcado, sin salirse por los lados.
  useLayoutEffect(() => {
    if (activo === null) return
    const cuadro = caja.current.querySelector(`[data-i="${activo}"]`)
    const marco = caja.current.getBoundingClientRect()
    const r = cuadro.getBoundingClientRect()
    const mitad = globo.current.offsetWidth / 2
    const x = Math.min(Math.max(r.left + r.width / 2 - marco.left, mitad), marco.width - mitad)
    globo.current.style.left = `${x}px`
    globo.current.style.top = `${r.top - marco.top}px`
    // Con teclado, si el cuadro queda fuera (en móvil la rejilla se desplaza), se trae a la vista.
    if (conTeclado) cuadro.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activo, conTeclado])

  const alPasar = (e) => {
    const i = e.target.dataset.i
    if (i === undefined) return
    setConTeclado(false)
    setActivo(Number(i))
  }

  const alPulsar = (e) => {
    const desde = activo ?? ultimo
    let destino
    if (e.key in PASOS) {
      destino = desde + PASOS[e.key]
      // Arriba y abajo no saltan de semana: en el lunes, "arriba" no hace nada.
      if (Math.abs(PASOS[e.key]) === 1 && Math.floor(destino / 7) !== Math.floor(desde / 7)) return
    } else if (e.key === 'Home') destino = primero
    else if (e.key === 'End') destino = ultimo
    else return
    e.preventDefault()
    if (celdas[destino]) {
      setConTeclado(true)
      setActivo(destino)
    }
  }

  return (
    <div className="gh" ref={caja}>
      <div
        ref={desplazable}
        className="gh-scroll"
        tabIndex={0}
        role="group"
        aria-label={t('actividad.grafico')}
        onFocus={() => {
          setConTeclado(true)
          setActivo((a) => a ?? ultimo)
        }}
        onBlur={() => setActivo(null)}
        onKeyDown={alPulsar}
      >
        <div className="gh-plot" aria-hidden="true">
          <div className="gh-months">
            {meses.map(({ columna, texto }) => (
              <span key={columna} style={{ gridColumn: `${columna + 1} / span 4` }}>
                {texto}
              </span>
            ))}
          </div>
          <div className="gh-body">
            <div className="gh-days">
              {dias.map((dia, i) => (
                <span key={i}>{dia}</span>
              ))}
            </div>
            <div className="gh-cells" onMouseOver={alPasar} onMouseLeave={() => setActivo(null)}>
              {celdas.map((celda, i) =>
                celda ? (
                  <span key={i} className={i === activo ? 'gh-c hot' : 'gh-c'} data-i={i} data-l={celda.nivel} />
                ) : (
                  <span key={i} className="gh-c" data-vacio="" />
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="gh-foot" aria-hidden="true">
        <span>{t('actividad.pie')}</span>
        <span className="gh-key">
          {t('actividad.menos')}
          {[0, 1, 2, 3, 4].map((nivel) => (
            <i key={nivel} data-l={nivel} />
          ))}
          {t('actividad.mas')}
        </span>
      </div>

      <div ref={globo} className={detalle ? 'gh-tip on' : 'gh-tip'} aria-hidden="true">
        {detalle && (
          <>
            <b>{detalle.cuantas}</b> · {detalle.cuando}
          </>
        )}
      </div>

      {/* Lo que oye el lector de pantalla al moverse con las flechas. */}
      <p className="solo-lector" aria-live="polite">
        {conTeclado && detalle ? `${detalle.cuantas}, ${detalle.cuando}` : ''}
      </p>
      <p className="solo-lector">{t('actividad.varias').replace('{n}', formatoNumero(lang).format(total))}</p>
    </div>
  )
}
