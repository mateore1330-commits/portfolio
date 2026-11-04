// Pinta un texto del contenido entendiendo sus dos únicas marcas:
// **negrita** → <b> y `código` → <code>. El resto va tal cual, como texto
// (nunca como HTML: así el contenido no puede colar etiquetas).
const MARCAS = /(\*\*[^*]+\*\*|`[^`]+`)/

export default function Marcado({ texto }) {
  return texto.split(MARCAS).map((trozo, i) => {
    if (trozo.startsWith('**') && trozo.endsWith('**')) return <b key={i}>{trozo.slice(2, -2)}</b>
    if (trozo.startsWith('`') && trozo.endsWith('`') && trozo.length > 1) return <code key={i}>{trozo.slice(1, -1)}</code>
    return trozo
  })
}
