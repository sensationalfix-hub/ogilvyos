/**
 * Visual references are examples of the equipment type, not photos from Forus.
 * Each Wikimedia Commons page contains the source's full license and attribution.
 */
export type GymVisual = {
  file: string;
  alt: string;
  author: string;
  license: string;
  kind?: "diagram";
};

export type GymGuide = {
  equipment: string;
  identify: string;
  setup: string;
  movement: string;
  caution: string;
  photo?: GymVisual;
  demo?: GymVisual;
};

const pic = (file: string, alt: string, author: string, license: string, kind?: "diagram"): GymVisual =>
  ({ file, alt, author, license, kind });

const cableStation = pic(
  "Multifunctional cable and row machines in a gym.jpg",
  "Estación de poleas regulables con columna de pesas y accesorios",
  "San Francisco Foghorn", "CC BY 2.0",
);

export const GYM_GUIDES: Record<string, GymGuide> = {
  leg_press: {
    equipment: "Prensa · plataforma grande para los pies",
    identify: "Busca una plataforma amplia frente a un asiento reclinado. Puede ser horizontal o inclinada.",
    setup: "Espalda y cadera pegadas al respaldo; pies a la anchura de los hombros.",
    movement: "Empuja sin bloquear las rodillas y vuelve despacio hasta un recorrido cómodo.",
    caution: "No levantes la pelvis. Si es inclinada, comprueba los seguros antes de empezar; sus kilos no equivalen a los de la horizontal.",
    photo: pic("Leg Press Machine.jpg", "Máquina de prensa de piernas con asiento y plataforma", "Paulmcdonald", "CC BY-SA 4.0"),
    demo: pic("Young man using a leg press machine at the gym.jpg", "Hombre utilizando la prensa de piernas en el gimnasio", "Nenad Stojkovic", "CC BY 2.0"),
  },
  chest_press: {
    equipment: "Press de pecho · asiento con dos empuñaduras",
    identify: "Tiene respaldo vertical y dos agarres a ambos lados del pecho que empujas hacia delante.",
    setup: "Ajusta el asiento para que los agarres queden aproximadamente a media altura del pecho.",
    movement: "Empuja hacia delante sin subir los hombros; vuelve controlando la carga.",
    caution: "Mantén espalda y cabeza en el respaldo. No abras los codos excesivamente.",
    photo: pic("Girl doing chest press machine exercise.jpg", "Mujer utilizando una máquina de press de pecho", "Tyler Read", "CC BY 2.0"),
  },
  lat_pulldown: {
    equipment: "Jalón al pecho · polea alta con barra larga",
    identify: "Asiento con rodillos que sujetan los muslos y una barra que cuelga sobre tu cabeza.",
    setup: "Asegura los muslos bajo los rodillos, pecho alto y manos algo más abiertas que los hombros.",
    movement: "Lleva los codos hacia abajo y tira de la barra hacia la zona alta del pecho; sube lento.",
    caution: "No tires detrás de la nuca ni te impulses balanceando la espalda.",
    photo: pic("Lat pulldown machine 20180112.jpg", "Máquina de jalón al pecho con asiento, rodillos y polea superior", "Santeri Viinamäki", "CC BY-SA 4.0"),
    demo: pic("Back Pull down.jpg", "Persona realizando un jalón al pecho en una máquina", "Aliva Sahoo", "CC BY-SA 4.0"),
  },
  shoulder_press: {
    equipment: "Press de hombros · empujas hacia arriba",
    identify: "Silla con respaldo y dos empuñaduras a la altura de hombros o cabeza.",
    setup: "Coloca el asiento para empezar con las manos a la altura de las orejas.",
    movement: "Empuja hacia arriba manteniendo el tronco estable; baja con control.",
    caution: "Evita arquear la zona lumbar o encoger los hombros.",
    photo: pic("Shoulder Press.jpg", "Máquina de press de hombros con asiento y brazos de empuje", "Aliva Sahoo", "CC BY-SA 4.0"),
    demo: pic("ShoulderPressMachineExercise.JPG", "Secuencia del press de hombros en máquina", "GeorgeStepanek", "CC BY-SA 3.0"),
  },
  ham_curl: {
    equipment: "Curl femoral · flexión de rodillas",
    identify: "Máquina con rodillo acolchado que queda detrás de los tobillos; puede ser tumbada o sentada.",
    setup: "Alinea las rodillas con el eje de giro y ajusta el rodillo por encima del talón.",
    movement: "Dobla las rodillas acercando los talones a los glúteos y vuelve lentamente.",
    caution: "La foto muestra la variante tumbada. Si la tuya es sentada, pide ayuda para ajustar el asiento y los apoyos.",
    photo: pic("LyingLegCurlMachineExercise.JPG", "Dos fases de curl femoral tumbado en máquina", "GeorgeStepanek", "CC BY-SA 3.0"),
  },
  triceps_rope: {
    equipment: "Polea alta · cuerda de dos extremos",
    identify: "Columna de pesas con cable regulable: coloca la polea arriba y engancha la cuerda.",
    setup: "De pie, codos cerca de las costillas, antebrazos flexionados.",
    movement: "Extiende los codos hacia abajo y separa un poco los extremos de la cuerda al final.",
    caution: "No muevas el torso. La imagen de ejecución muestra barra; para tu rutina usa cuerda.",
    photo: cableStation,
    demo: pic("CableMachinePushdown.JPG", "Demostración de extensión de tríceps en polea con barra", "GeorgeStepanek", "CC BY-SA 3.0"),
  },
  crunch: {
    equipment: "Máquina de abdominales · crunch sentado",
    identify: "Silla con almohadillas a la altura del pecho o brazos y una palanca para flexionar el tronco.",
    setup: "Ajusta el asiento y los apoyos para no forzar cuello ni cadera.",
    movement: "Acerca suavemente costillas a pelvis contrayendo el abdomen; regresa despacio.",
    caution: "No tires con los brazos ni te dobles desde el cuello; algunas máquinas tienen un diseño distinto.",
    photo: pic("Máquina de entrenamiento (Abdominales) - A740088.jpg", "Máquina de abdominales con asiento y estructura de resistencia", "Rjcastillo", "CC BY 4.0"),
  },
  goblet: {
    equipment: "Zona de mancuernas · sin máquina",
    identify: "Solo necesitas una mancuerna que puedas sujetar verticalmente delante del pecho.",
    setup: "Pies a la anchura de los hombros, mancuerna pegada al pecho.",
    movement: "Flexiona caderas y rodillas como para sentarte; sube empujando el suelo.",
    caution: "Talones apoyados, espalda neutra. Baja hasta donde puedas controlar.",
    photo: pic("Artemis Program Physical Exercise (7654258).jpg", "Personas realizando sentadillas goblet con una pesa delante del pecho", "U.S. Marine Corps / Lance Cpl. Kristy Ordonez", "Dominio público"),
  },
  row: {
    equipment: "Remo sentado · agarres frente al torso",
    identify: "Busca asiento o banco frente a una polea baja; algunas versiones tienen apoyo para el pecho.",
    setup: "Pies estables, espalda larga, hombros lejos de las orejas.",
    movement: "Lleva los codos hacia atrás acercando el agarre al ombligo; estira los brazos despacio.",
    caution: "No te balancees ni redondees la espalda para ganar recorrido.",
    photo: pic("Woman using a seated cable row machine at the gym.jpg", "Mujer utilizando una máquina de remo sentado con cable", "Miguel Angel Omaña Rojas", "CC0"),
  },
  incline_press: {
    equipment: "Press inclinado · empuje en diagonal",
    identify: "Parecida al press de pecho, pero los agarres se desplazan hacia delante y algo hacia arriba.",
    setup: "Asiento ajustado para empezar con agarres a la altura de la parte alta del pecho.",
    movement: "Empuja en diagonal siguiendo el recorrido de la máquina; regresa sin rebote.",
    caution: "No dejes que los hombros se adelanten al bajar ni arquees la lumbar.",
    photo: pic("Chest Incline.jpg", "Máquina de press de pecho inclinado", "Aliva Sahoo", "CC BY-SA 4.0"),
    demo: pic("Incline-chest-press-1.png", "Ilustración de la posición inicial del press inclinado", "Everkinetic", "CC BY-SA 3.0", "diagram"),
  },
  lateral_raise: {
    equipment: "Zona de mancuernas · sin máquina",
    identify: "Dos mancuernas ligeras y espacio para extender los brazos a los lados.",
    setup: "De pie, codos un poco flexionados y abdomen firme.",
    movement: "Eleva los brazos hacia los lados hasta aproximadamente altura de hombros y baja lento.",
    caution: "Evita encoger el cuello o dar impulso con las piernas.",
    photo: pic("Fitness model shoulder exercise weight training (32004749033).jpg", "Deportista haciendo elevaciones laterales con mancuernas", "ThoroughlyReviewed", "CC BY 2.0"),
    demo: pic("DumbbellLateralRaise.JPG", "Dos fases de una elevación lateral con mancuernas", "GeorgeStepanek", "CC BY-SA 3.0"),
  },
  quad_ext: {
    equipment: "Extensión de piernas · rodillo frente a las espinillas",
    identify: "Asiento con respaldo y un rodillo por delante de los tobillos.",
    setup: "Alinea rodillas con el eje de la máquina y coloca el rodillo cerca del empeine.",
    movement: "Estira las rodillas de forma controlada y vuelve lentamente.",
    caution: "Sin patadas ni bloqueo brusco. Si molesta la rodilla, reduce peso o recorrido.",
    photo: pic("LegExtensionMachineExercise.JPG", "Dos fases de extensión de cuádriceps en máquina", "GeorgeStepanek", "CC BY-SA 3.0"),
  },
  reverse_pec: {
    equipment: "Peck deck inversa · máquina de aperturas",
    identify: "Máquina de aperturas con asiento y dos brazos móviles. Para deltoide posterior se usa de cara al respaldo.",
    setup: "Pecho hacia el respaldo, manos en los agarres y brazos casi extendidos.",
    movement: "Abre los brazos hacia atrás separando las manos; vuelve sin dejar caer el peso.",
    caution: "La máquina puede permitir también aperturas de pecho: pide que te enseñen la configuración inversa.",
    photo: pic("Shoulder Fly Machine.jpg", "Máquina de aperturas para hombros con brazos móviles", "Aliva Sahoo", "CC BY-SA 4.0"),
  },
  biceps_db: {
    equipment: "Zona de mancuernas · sin máquina",
    identify: "Busca un par de mancuernas del mismo peso.",
    setup: "De pie o sentado, brazos a los lados, codos junto al tronco.",
    movement: "Flexiona los codos para subir las mancuernas sin mover la parte superior del brazo.",
    caution: "No balancees el cuerpo. Los kilos que registra la app son por mancuerna.",
    photo: pic("Girl exercising doing dumbbell curls.jpg", "Mujer realizando curl de bíceps con mancuernas", "PTPioneer", "CC BY 2.0"),
  },
  plank: {
    equipment: "Esterilla · sin máquina",
    identify: "Necesitas una esterilla y espacio para apoyarte sobre antebrazos y puntas de pies.",
    setup: "Codos bajo los hombros, piernas estiradas y cuerpo en línea.",
    movement: "Mantén la posición respirando con normalidad los segundos indicados.",
    caution: "No dejes caer la cintura ni eleves demasiado la cadera.",
    photo: pic("Plank exercise.svg", "Ilustración de la posición de plancha de antebrazos", "Pk0001", "CC BY-SA 4.0", "diagram"),
  },
  lat_neutral: {
    equipment: "Jalón al pecho · agarre paralelo",
    identify: "Misma estación de jalón, pero con una empuñadura donde las palmas se miran.",
    setup: "Sujeta los muslos bajo los rodillos, pecho alto y manos en agarre paralelo.",
    movement: "Baja los codos a los costados y lleva el agarre hacia la parte alta del pecho.",
    caution: "No te eches hacia atrás para usar impulso; el accesorio puede cambiar según Forjas.",
    photo: pic("Lat pulldown machine 20180112.jpg", "Máquina de jalón al pecho, compatible con distintos agarres", "Santeri Viinamäki", "CC BY-SA 4.0"),
    demo: pic("Back Pull down.jpg", "Ejemplo de jalón al pecho; aquí aparece barra larga, no agarre neutro", "Aliva Sahoo", "CC BY-SA 4.0"),
  },
  glute_bridge: {
    equipment: "Esterilla · sin máquina",
    identify: "Se hace en el suelo; no necesitas banco ni máquina en esta versión inicial.",
    setup: "Túmbate boca arriba, rodillas dobladas y pies apoyados cerca de los glúteos.",
    movement: "Eleva la cadera apretando glúteos, pausa un segundo y baja lento.",
    caution: "No exageres el arco lumbar: sube desde la cadera.",
    photo: pic("Glute-bridge.png", "Ilustración del puente de glúteos desde el suelo", "Marianne Gilbak", "CC BY-SA 4.0", "diagram"),
  },
  face_pull: {
    equipment: "Polea alta · cuerda de dos extremos",
    identify: "Estación de cable regulable como la de tríceps, pero con la polea aproximadamente a la altura de la cara.",
    setup: "De pie, tira de la cuerda con brazos estirados y da un paso atrás para tensar el cable.",
    movement: "Lleva la cuerda hacia la frente abriendo los codos y separando las manos.",
    caution: "Peso ligero, hombros abajo. No lo conviertas en un remo con todo el cuerpo.",
    photo: cableStation,
  },
  biceps_cable: {
    equipment: "Polea baja · barra corta",
    identify: "Misma torre de cables; baja la polea cerca del suelo y engancha una barra corta.",
    setup: "Ponte de pie frente a la polea, manos supinas y codos junto al cuerpo.",
    movement: "Flexiona los codos para llevar la barra hacia el pecho sin adelantar los brazos.",
    caution: "Evita echarte hacia atrás. Los kilos son los de la torre de pesas.",
    photo: cableStation,
    demo: pic("Standing biceps curl with cable 1.svg", "Dibujo de curl de bíceps con una polea baja", "Everkinetic", "CC BY-SA 3.0", "diagram"),
  },
  dead_bug: {
    equipment: "Esterilla · sin máquina",
    identify: "Es un ejercicio tumbado en el suelo, sin pesas.",
    setup: "Boca arriba: rodillas y caderas a 90°, brazos apuntando al techo.",
    movement: "Estira lentamente brazo derecho y pierna izquierda, vuelve al centro y alterna.",
    caution: "Mantén la zona lumbar estable y pegada suavemente al suelo. Acorta el recorrido si se arquea.",
  },
};

export const commonsImageUrl = (visual: GymVisual) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(visual.file.replace(/ /g, "_"))}?width=640`;

export const commonsFileUrl = (visual: GymVisual) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(visual.file.replace(/ /g, "_"))}`;
