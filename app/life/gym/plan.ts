export type RoutineCode = "A" | "B" | "C";
export type GymMode = "express" | "full";

export type GymExercise = {
  id: string;
  name: string;
  group: string;
  sets: number;
  reps: string;
  start: number;
  step: number;
  range: string;
  hint: string;
};

export type Routine = {
  code: RoutineCode;
  title: string;
  subtitle: string;
  accent: string;
  express: string[];
  exercises: GymExercise[];
};

export type LoggedSet = { kg: number; reps: number; done: boolean };
export type GymLog = {
  version: 1;
  routine: RoutineCode;
  mode: GymMode;
  startedAt: string;
  finishedAt?: string;
  sets: Record<string, LoggedSet[]>;
};

export const ROUTINES: Routine[] = [
  {
    code: "A",
    title: "Pecho + espalda",
    subtitle: "Empuje, tracción y base de piernas.",
    accent: "#d9f36d",
    express: ["leg_press", "chest_press", "lat_pulldown", "shoulder_press", "crunch"],
    exercises: [
      { id: "leg_press", name: "Prensa de piernas", group: "Piernas", sets: 2, reps: "10–12", start: 50, step: 10, range: "40–70 kg*", hint: "Pies bien apoyados. Baja sin despegar la cadera." },
      { id: "chest_press", name: "Press de pecho · máquina", group: "Pecho", sets: 3, reps: "8–12", start: 20, step: 2.5, range: "15–30 kg", hint: "Hombros abajo y atrás. Movimiento controlado." },
      { id: "lat_pulldown", name: "Jalón al pecho", group: "Espalda", sets: 3, reps: "8–12", start: 25, step: 2.5, range: "20–35 kg", hint: "Tira hacia el pecho, nunca detrás de la nuca." },
      { id: "shoulder_press", name: "Press de hombros · máquina", group: "Hombros", sets: 2, reps: "10–12", start: 15, step: 2.5, range: "10–20 kg", hint: "Evita arquear la espalda." },
      { id: "ham_curl", name: "Curl femoral · máquina", group: "Piernas", sets: 2, reps: "10–12", start: 20, step: 2.5, range: "15–25 kg", hint: "Controla la bajada, sin tirones." },
      { id: "triceps_rope", name: "Tríceps en polea", group: "Tríceps", sets: 2, reps: "10–15", start: 15, step: 2.5, range: "10–20 kg", hint: "Codos quietos, junto al torso." },
      { id: "crunch", name: "Crunch en máquina", group: "Core", sets: 2, reps: "12–15", start: 15, step: 2.5, range: "10–20 kg", hint: "Flexiona el abdomen, no tires del cuello." },
    ],
  },
  {
    code: "B",
    title: "Espalda + hombros",
    subtitle: "Amplitud de espalda y fuerza de piernas.",
    accent: "#d5d8ff",
    express: ["goblet", "row", "incline_press", "lateral_raise", "plank"],
    exercises: [
      { id: "goblet", name: "Sentadilla goblet", group: "Piernas", sets: 2, reps: "10", start: 10, step: 2, range: "8–14 kg", hint: "Una mancuerna frente al pecho, recorrido cómodo." },
      { id: "row", name: "Remo sentado · máquina", group: "Espalda", sets: 3, reps: "8–12", start: 25, step: 2.5, range: "20–35 kg", hint: "Lleva los codos atrás sin balancearte." },
      { id: "incline_press", name: "Press inclinado · máquina", group: "Pecho", sets: 3, reps: "8–12", start: 20, step: 2.5, range: "15–25 kg", hint: "Pecho alto y hombros controlados." },
      { id: "lateral_raise", name: "Elevaciones laterales", group: "Hombros", sets: 2, reps: "12–15", start: 4, step: 1, range: "3–5 kg/mano", hint: "Sin impulso. El peso es por mancuerna." },
      { id: "quad_ext", name: "Extensión de cuádriceps", group: "Piernas", sets: 2, reps: "10–12", start: 20, step: 2.5, range: "15–30 kg", hint: "Sin golpe al extender las rodillas." },
      { id: "reverse_pec", name: "Pájaros · peck deck", group: "Hombros", sets: 2, reps: "12–15", start: 15, step: 2.5, range: "10–20 kg", hint: "Aprieta la parte posterior de hombros." },
      { id: "biceps_db", name: "Curl de bíceps · mancuernas", group: "Bíceps", sets: 2, reps: "10–12", start: 6, step: 1, range: "5–8 kg/mano", hint: "Codos quietos. El peso es por mancuerna." },
      { id: "plank", name: "Plancha", group: "Core", sets: 2, reps: "25–40 s", start: 0, step: 0, range: "Peso corporal", hint: "Abdomen firme y respiración continua." },
    ],
  },
  {
    code: "C",
    title: "Full body + brazos",
    subtitle: "Consolidar la semana. Brazos y postura.",
    accent: "#ffd9c5",
    express: ["leg_press", "lat_neutral", "chest_press", "face_pull", "dead_bug"],
    exercises: [
      { id: "leg_press", name: "Prensa de piernas", group: "Piernas", sets: 2, reps: "10–12", start: 50, step: 10, range: "40–70 kg*", hint: "Repite la misma máquina para comparar." },
      { id: "lat_neutral", name: "Jalón agarre neutro", group: "Espalda", sets: 3, reps: "8–12", start: 25, step: 2.5, range: "20–35 kg", hint: "Hombros lejos de las orejas." },
      { id: "chest_press", name: "Press de pecho · máquina", group: "Pecho", sets: 3, reps: "8–12", start: 20, step: 2.5, range: "15–30 kg", hint: "Misma técnica y máquina que en A." },
      { id: "glute_bridge", name: "Puente de glúteos", group: "Piernas", sets: 2, reps: "12–15", start: 0, step: 0, range: "Peso corporal", hint: "Pausa un segundo arriba." },
      { id: "face_pull", name: "Face pull · polea", group: "Hombros", sets: 2, reps: "12–15", start: 7.5, step: 2.5, range: "5–12,5 kg", hint: "Tira de la cuerda hacia la cara." },
      { id: "biceps_cable", name: "Curl de bíceps · polea", group: "Bíceps", sets: 2, reps: "10–12", start: 10, step: 2.5, range: "7,5–15 kg", hint: "No balancees el cuerpo." },
      { id: "triceps_rope", name: "Tríceps con cuerda", group: "Tríceps", sets: 2, reps: "10–12", start: 15, step: 2.5, range: "10–20 kg", hint: "Extiende sin bloquear de golpe." },
      { id: "dead_bug", name: "Dead bug", group: "Core", sets: 2, reps: "8/lado", start: 0, step: 0, range: "Peso corporal", hint: "Mantén la espalda baja estable." },
    ],
  },
];

export const getRoutine = (code: RoutineCode) => ROUTINES.find(r => r.code === code) ?? ROUTINES[0];

export const nextRoutine = (code: RoutineCode): RoutineCode => code === "A" ? "B" : code === "B" ? "C" : "A";

export const visibleExercises = (routine: Routine, mode: GymMode) =>
  mode === "full" ? routine.exercises : routine.exercises.filter(e => routine.express.includes(e.id));

export const setCount = (log: GymLog) =>
  Object.values(log.sets).flat().filter(set => set.done).length;

export const sessionVolume = (log: GymLog) =>
  Object.values(log.sets).flat().filter(set => set.done).reduce((sum, set) => sum + set.kg * set.reps, 0);
