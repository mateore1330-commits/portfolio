#!/usr/bin/env node
// Después de `vite build`: una copia de index.html por página, cada una con su propia
// cabecera (título, descripción, idioma, enlace canónico, hreflang, Open Graph y
// Twitter Card), más sitemap.xml y robots.txt.
//
// Por qué: LinkedIn, WhatsApp o X no ejecutan JavaScript. Al pegar un enlace leen solo
// el HTML inicial; sin esto, todas las páginas enseñarían la misma tarjeta. El contenido
// lo sigue montando React igual; solo cambia la cabecera.
//
// Uso: lo lanza `npm run build` (apps/web). Sin dependencias.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../apps/web/', import.meta.url))
const DIST = join(WEB, 'dist')
const SITIO = (process.env.VITE_SITE_URL ?? 'https://mateorodriguez.solutions').replace(/\/$/, '')
const IDIOMAS = ['es', 'en']
const LOCALE = { es: 'es_ES', en: 'en_US' }
const MAX_DESCRIPCION = 160

const leerJson = async (ruta) => JSON.parse(await readFile(join(WEB, ruta), 'utf8'))
const contenido = await leerJson('src/content/snapshot.json')
const interfaz = { es: await leerJson('src/i18n/es.json'), en: await leerJson('src/i18n/en.json') }

const pick = (campo, lang) => (campo && typeof campo === 'object' && !Array.isArray(campo) ? campo[lang] : campo)
const sinMarcas = (texto) => texto.replace(/\*\*|`/g, '')
const recortar = (texto) => {
  const limpio = sinMarcas(texto).replace(/\s+/g, ' ').trim()
  return limpio.length <= MAX_DESCRIPCION ? limpio : `${limpio.slice(0, MAX_DESCRIPCION - 1).replace(/\s+\S*$/, '')}…`
}
const escapar = (texto) =>
  String(texto).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const ruta = (lang, resto) => (lang === 'en' ? `/en${resto === '/' ? '' : resto}` : resto)

// Todas las páginas: la portada, cada proyecto publicado y las dos legales, en cada idioma.
function paginas() {
  const lista = []
  const textos = contenido.site_texts
  for (const lang of IDIOMAS) {
    const titulo = (t) => interfaz[lang]['proyecto.titulo'].replace('{nombre}', t)
    lista.push({
      lang,
      resto: '/',
      titulo: interfaz[lang]['meta.titulo'],
      descripcion: recortar(pick(textos['hero.entradilla'], lang)),
      imagen: `/compartir/portada-${lang}.jpg`,
      tipo: 'website',
    })
    for (const p of contenido.projects) {
      lista.push({
        lang,
        resto: `/proyectos/${p.slug}`,
        titulo: titulo(pick(p.name, lang)),
        descripcion: recortar(pick(p.summary, lang)),
        imagen: `/compartir/proyecto-${p.slug}-${lang}.jpg`,
        tipo: 'article',
      })
    }
    for (const [clave, resto] of [['aviso', '/aviso-legal'], ['privacidad', '/privacidad']]) {
      const pagina = pick(textos[`legal.${clave}`], lang)
      lista.push({
        lang,
        resto,
        titulo: titulo(pagina.titulo),
        descripcion: recortar(pagina.bloques[0].texto.join(' ')),
        imagen: `/compartir/portada-${lang}.jpg`,
        tipo: 'website',
      })
    }
  }
  return lista
}

function cabecera(p) {
  const url = SITIO + ruta(p.lang, p.resto)
  const imagen = SITIO + p.imagen
  const otro = p.lang === 'es' ? 'en' : 'es'
  return [
    `<title>${escapar(p.titulo)}</title>`,
    `<meta name="description" content="${escapar(p.descripcion)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...IDIOMAS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITIO + ruta(l, p.resto)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITIO + ruta('es', p.resto)}" />`,
    `<meta property="og:type" content="${p.tipo}" />`,
    `<meta property="og:site_name" content="Mateo Rodríguez" />`,
    `<meta property="og:title" content="${escapar(p.titulo)}" />`,
    `<meta property="og:description" content="${escapar(p.descripcion)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${imagen}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapar(p.titulo)}" />`,
    `<meta property="og:locale" content="${LOCALE[p.lang]}" />`,
    `<meta property="og:locale:alternate" content="${LOCALE[otro]}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapar(p.titulo)}" />`,
    `<meta name="twitter:description" content="${escapar(p.descripcion)}" />`,
    `<meta name="twitter:image" content="${imagen}" />`,
  ].join('\n    ')
}

// El retrato es lo más grande de la portada (el LCP de Lighthouse), pero el navegador no
// lo descubre hasta que React pinta la página. Avisarle desde el HTML adelanta su descarga.
// Mismos archivos y mismo `sizes` que el <picture> de Hero.jsx: si cambian allí, cambiar aquí.
const RETRATO_SIZES = '(max-width: 980px) min(78vw, 420px), 38vw'

async function precargaRetrato() {
  const avif = (await readdir(join(DIST, 'assets')))
    .map((archivo) => archivo.match(/^retrato-(\d+)-[\w-]+\.avif$/))
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1])
  if (!avif.length) throw new Error('No encuentro el retrato en AVIF en dist/assets.')
  const srcset = avif.map(([archivo, ancho]) => `/assets/${archivo} ${ancho}w`).join(', ')
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset}" imagesizes="${RETRATO_SIZES}" fetchpriority="high" />`
}

const INICIO = '<!-- cabecera:inicio -->'
const FIN = '<!-- cabecera:fin -->'

async function main() {
  const plantilla = await readFile(join(DIST, 'index.html'), 'utf8')
  if (!plantilla.includes(INICIO) || !plantilla.includes(FIN)) {
    throw new Error(`index.html no tiene las marcas ${INICIO} y ${FIN}.`)
  }
  const lista = paginas()
  const retrato = await precargaRetrato()

  for (const p of lista) {
    const html = plantilla
      .replace(/<html lang="[^"]*">/, `<html lang="${p.lang}">`)
      .replace(
        new RegExp(`${INICIO}[\\s\\S]*?${FIN}`),
        `${INICIO}\n    ${cabecera(p)}${p.resto === '/' ? `\n    ${retrato}` : ''}\n    ${FIN}`,
      )
    const destino = join(DIST, ruta(p.lang, p.resto), 'index.html')
    await mkdir(dirname(destino), { recursive: true })
    await writeFile(destino, html)
  }

  // sitemap.xml: cada página con su versión en el otro idioma.
  const urls = lista
    .filter((p) => p.lang === 'es')
    .flatMap((p) =>
      IDIOMAS.map((lang) => {
        const alternativas = IDIOMAS.map(
          (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITIO + ruta(l, p.resto)}"/>`,
        ).join('\n')
        return `  <url>\n    <loc>${SITIO + ruta(lang, p.resto)}</loc>\n${alternativas}\n  </url>`
      }),
    )
  await writeFile(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
  )

  // robots.txt: todo abierto. El panel no se nombra aquí (ADM-01): su dirección es
  // aleatoria y escribirla en robots.txt sería señalar la puerta. Sus páginas llevan noindex.
  await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITIO}/sitemap.xml\n`)

  console.log(`paginas-estaticas: ${lista.length} páginas, sitemap.xml (${urls.length} direcciones) y robots.txt.`)
}

await main()
