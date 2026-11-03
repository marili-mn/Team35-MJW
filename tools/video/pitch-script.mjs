// The team part of the pitch video, following the professor's e-mail (docs/video/guion.md, section 3): the
// ten points, each answered by the member whose role it is. One ElevenLabs take per member, every line its
// own paragraph so the voice pauses between them (make-pitch.mjs cuts the take at those pauses).
// `say` is what the voice reads; the subtitles show the same line with SHOW applied (itch.io, figures).
// Lines marked `confirm` are opinions or plans written for the team: each member should confirm their own.

export const MEMBERS = {   // in the GDD's order (the end card lists them like this)
  nahuel: { name: "Nahuel Marcilli", role: "Diseño, programación y GDD", voice: "Tomas - Argentina & Uruguaya" },
  jorgelina: { name: "Jorgelina Elizabeth Mendieta", role: "Arte, paleta y niveles", voice: "Valeria - Cheerful, Youthful, Catchy" },
  taoufik: { name: "Taoufik Saidi", role: "Narrativa y mecánicas", voice: "Pablo - Argentino, Córdoba" },
  delcy: { name: "Delcy Adalis Villalba Olmedo", role: "Audio, testing y agenda", voice: "Cande - Friend from Buenos Aires" },
};

export const CHAPTERS = {
  1: "Cómo surgió la idea",
  2: "El género",
  3: "Nuestras referencias",
  4: "La historia de Kaito",
  5: "Los perfiles del equipo",
  6: "Herramientas e inteligencia artificial",
  7: "La experiencia",
  8: "Eventos y talleres",
  9: "Lo que necesitamos",
  10: "La industria en Argentina",
  11: "",
};

// [member, chapter, line, confirm?] in the order they are heard.
export const LINES = [
  ["nahuel", 1, "Hola, soy Nahuel Marcilli. En el grupo me encargué del diseño, la programación y el documento de diseño."],
  ["nahuel", 1, "Todo arrancó con una actividad de la materia: teníamos que crear un personaje y animarlo en pixel art."],
  ["nahuel", 1, "Ahí nació Kaito, un ninja. Y se nos ocurrió: ¿y si su único poder fuera invertir la gravedad?"],
  ["nahuel", 2, "Es un juego de plataformas y acción en 2D, con una estética de fantasía oscura japonesa."],
  ["nahuel", 2, "Corrés, peleás con la katana y, cuando el camino se corta, das vuelta la gravedad y seguís por el techo."],
  ["nahuel", 2, "Eso sí: cada giro gasta energía, y para recuperarla tenés que juntar cristales."],
  ["taoufik", 3, "Yo soy Taoufik Saidi, y me tocó la narrativa y las mecánicas."],
  ["taoufik", 3, "Nos fijamos mucho en tres juegos. De VVVVVV sacamos la gravedad invertida, pero acá le pusimos un costo."],
  ["taoufik", 3, "De Celeste, que lo difícil se sienta justo. Y de Katana ZERO, la katana que te devuelve los ataques."],
  ["taoufik", 4, "En el Japón feudal, el clan Kuroshini asalta el templo Shinobi y se roba el Pergamino del Equilibrio Gravitatorio."],
  ["taoufik", 4, "Los techos se vuelven suelo, y Kaito es el único que sobrevive."],
  ["taoufik", 4, "Con el sello del pergamino puede invertir su gravedad, y tiene que cruzar tres niveles hasta el Templo de la Luna Roja, donde lo espera la Maga Oscura."],
  ["delcy", 5, "Hola, soy Delcy Villalba. Me ocupé del audio, las pruebas y de organizar la agenda del grupo."],
  ["delcy", 5, "En arte, Jorgelina armó la paleta y los niveles, y a los personajes en pixel art los dibujamos entre varios. Nahuel programó, y Taoufik escribió la historia."],
  ["delcy", 5, "Lo que nos falta es alguien de marketing y redes: hoy nos mostramos con la página de itch punto io y la web del documento de diseño."],
  ["jorgelina", 6, "Soy Jorgelina Mendieta. Trabajé en el arte, la paleta de colores y la parte visual del tutorial y de los niveles."],
  ["jorgelina", 6, "Además de GDevelop, usamos Piskel y Aseprite para dibujar y animar cuadro por cuadro, y Krita y Photopea para retocar."],
  ["nahuel", 6, "La inteligencia artificial la usamos como apoyo, no como reemplazo."],
  ["nahuel", 6, "Nos ahorró tiempo en la programación, en las pruebas y en el sonido, nos ayudó a ordenar el guion de este video, y las voces son de ElevenLabs."],
  ["nahuel", 6, "Pero las ideas, los personajes, el arte y cada decisión del juego salieron del equipo."],
  ["delcy", 7, "Para nosotros fue un desafío enorme: pasar de un personaje en pixel art a un juego con tres niveles y una jefa final.", true],
  ["delcy", 7, "El playtest nos enseñó un montón. El arte fue lo que más gustó, pero los controles sacaron tres coma cuatro sobre cinco."],
  ["delcy", 7, "Nos dijeron que se sentían resbaladizos, así que rehicimos el salto y la gravedad."],
  ["jorgelina", 8, "¿Si nos animaríamos a presentarlo en un evento o en un taller? Sí, claro.", true],
  ["jorgelina", 8, "Ver a otras personas jugándolo es la mejor prueba. Lo próximo es publicarlo en itch punto io y hacer otro playtest.", true],
  ["nahuel", 9, "Para que sea un producto completo nos faltan más niveles, soporte para mando y celular, y muchas más pruebas con jugadores."],
  ["nahuel", 9, "También necesitaríamos a alguien de marketing, música compuesta a medida y financiamiento para publicarlo en Steam, en PC y en Android."],
  ["taoufik", 10, "Y sí, nos interesa mucho conocer la industria de videojuegos en Argentina.", true],
  ["taoufik", 10, "La EVA, la exposición que organiza ADVA, ya va por su edición veinticuatro, y en EVA Play los estudios muestran sus juegos."],
  ["taoufik", 10, "Nos encantaría aprender de quienes ya publicaron, y algún día llevar a Kaito ahí.", true],
  ["delcy", 11, "Así que ya saben: pruébenlo, traten de romperlo y cuéntennos qué les pasó. Gravity Runner: Dash, del Grupo 35."],
];

// What the voice says → what the subtitle shows.
export const SHOW = [["itch punto io", "itch.io"], ["tres coma cuatro sobre cinco", "3,4 sobre 5"], ["edición veinticuatro", "edición 24"]];
export const shown = (line) => SHOW.reduce((s, [a, b]) => s.replaceAll(a, b), line);

// The text to paste in ElevenLabs for one member: their lines in order, one paragraph each.
export const takeText = (member) => LINES.filter(([m]) => m === member).map(([, , line]) => line).join("\n\n");
