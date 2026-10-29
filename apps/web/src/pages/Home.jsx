import snapshot from '@/content/snapshot.json'

// De momento solo el nombre, para comprobar que la instantánea va dentro del bundle.
// La carga con respaldo y los idiomas llegan con WEB-01 y WEB-02.
export default function Home() {
  return <main>{snapshot.site_texts['hero.nombre'].es} · en construcción</main>
}
