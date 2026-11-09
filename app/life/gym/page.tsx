"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3,
  Dumbbell, ExternalLink, Image as ImageIcon, LoaderCircle, Minus, Pause, Play,
  Plus, RotateCcw, TrendingUp,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getRoutine, nextRoutine, ROUTINES, sessionVolume, setCount, visibleExercises,
  type GymExercise, type GymLog, type GymMode, type LoggedSet, type RoutineCode,
} from "./plan";
import { commonsFileUrl, commonsImageUrl, GYM_GUIDES, type GymVisual } from "./guide";
import styles from "./gym.module.css";

type GymEntry = {
  id: string;
  kind: string;
  title: string;
  entry_date: string;
  category: string | null;
  status: string | null;
  metadata: { gym?: GymLog; metric?: string };
  created_at: string;
};

const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const dateText = (date: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(date + "T12:00:00"));
const number = (value: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
const isGym = (entry: GymEntry): entry is GymEntry & { metadata: { gym: GymLog } } =>
  entry.kind === "health" && entry.category === "entreno" && Boolean(entry.metadata?.gym?.version === 1);
const isDone = (entry: GymEntry): entry is GymEntry & { metadata: { gym: GymLog } } =>
  isGym(entry) && entry.status === "completed";
const targetReps = (exercise: GymExercise) => exercise.id === "plank" ? 30 : exercise.id === "dead_bug" ? 8 : 10;

function latestWeight(entries: GymEntry[], id: string, fallback: number) {
  for (const entry of entries) {
    if (!isDone(entry)) continue;
    const sets = entry.metadata.gym.sets[id] ?? [];
    const last = [...sets].reverse().find(set => set.done);
    if (last) return last.kg;
  }
  return fallback;
}

function initialLog(code: RoutineCode, mode: GymMode, entries: GymEntry[]): GymLog {
  const sets: Record<string, LoggedSet[]> = {};
  for (const exercise of visibleExercises(getRoutine(code), mode)) {
    const kg = latestWeight(entries, exercise.id, exercise.start);
    sets[exercise.id] = Array.from({ length: exercise.sets }, () => ({ kg, reps: targetReps(exercise), done: false }));
  }
  return { version: 1, routine: code, mode, startedAt: new Date().toISOString(), sets };
}

function GuidePhoto({ visual, label }: { visual: GymVisual; label: string }) {
  return <figure className={styles.guidePhoto}>
    <div className={styles.guidePhotoFrame}>
      {/* Commons images are external, licensed references: keep their source linked below. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={visual.kind === "diagram" ? styles.guideDiagram : ""} src={commonsImageUrl(visual)} alt={visual.alt} loading="lazy"/>
    </div>
    <figcaption><span>{label}</span><a href={commonsFileUrl(visual)} target="_blank" rel="noreferrer" title="Ver autor y licencia de la imagen en Wikimedia Commons">
      {visual.author} · {visual.license} <ExternalLink size={11}/>
    </a></figcaption>
  </figure>;
}

export default function LifeGymPage() {
  const [entries, setEntries] = useState<GymEntry[]>([]);
  const [active, setActive] = useState<(GymEntry & { metadata: { gym: GymLog } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<GymMode>("express");
  const [openGuideId, setOpenGuideId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState("chest_press");
  const [rest, setRest] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/life/entries", { cache: "no-store" });
      const body = await response.json() as { entries?: GymEntry[]; error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Inicia sesión en LifeOS para guardar tus entrenamientos." : body.error || "Error de conexión");
      const all = (body.entries ?? []).filter(isGym).sort((a, b) => b.created_at.localeCompare(a.created_at));
      setEntries(all);
      setActive(all.find(entry => entry.status === "in_progress") ?? null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido cargar el entrenamiento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!restRunning || rest <= 0) return;
    const timer = window.setTimeout(() => setRest(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [rest, restRunning]);
  useEffect(() => { if (rest === 0) setRestRunning(false); }, [rest]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const completed = useMemo(() => entries.filter(isDone), [entries]);
  const routineCode: RoutineCode = active?.metadata.gym.routine
    ?? (completed[0] ? nextRoutine(completed[0].metadata.gym.routine) : "A");
  const routine = getRoutine(routineCode);
  const sessionExercises = visibleExercises(routine, active?.metadata.gym.mode ?? mode);
  const gymLog = active?.metadata.gym;
  const totalSets = sessionExercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const doneSets = gymLog ? setCount(gymLog) : 0;
  const progress = totalSets ? Math.round(doneSets / totalSets * 100) : 0;
  const lastFourWeeks = completed.filter(entry => new Date(entry.entry_date + "T12:00:00").getTime() >= Date.now() - 28 * 86400000).length;
  const lastWeek = completed.filter(entry => new Date(entry.entry_date + "T12:00:00").getTime() >= Date.now() - 7 * 86400000).length;

  const chartExercises = useMemo(() => {
    const byId = new Map<string, GymExercise>();
    ROUTINES.forEach(r => r.exercises.forEach(e => byId.set(e.id, e)));
    return [...byId.values()].filter(exercise =>
      completed.some(entry => entry.metadata.gym.sets[exercise.id]?.some(set => set.done && set.kg > 0)));
  }, [completed]);
  useEffect(() => {
    if (chartExercises.length && !chartExercises.some(exercise => exercise.id === selectedExercise)) {
      setSelectedExercise(chartExercises[0].id);
    }
  }, [chartExercises, selectedExercise]);
  const graph = useMemo(() => completed.slice().reverse().flatMap(entry => {
    const sets = entry.metadata.gym.sets[selectedExercise] ?? [];
    const valid = sets.filter(set => set.done && set.kg > 0);
    return valid.length ? [{ date: dateText(entry.entry_date), kg: Math.max(...valid.map(set => set.kg)) }] : [];
  }).slice(-10), [completed, selectedExercise]);

  const persist = (entry: GymEntry & { metadata: { gym: GymLog } }) => {
    const payload = { id: entry.id, metadata: { gym: entry.metadata.gym } };
    setSaving(true);
    writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
      const response = await fetch("/api/life/entries", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "No se pudo guardar esta serie");
      }
    });
    void writeQueue.current.catch(cause => setError(cause instanceof Error ? cause.message : "Error al guardar")).finally(() => setSaving(false));
    return writeQueue.current;
  };

  function updateSet(id: string, index: number, change: Partial<LoggedSet>) {
    if (!active) return;
    const current = active.metadata.gym.sets[id] ?? [];
    const nextSet = { ...current[index], ...change };
    if (!Number.isFinite(nextSet.kg) || !Number.isFinite(nextSet.reps)) return;
    nextSet.kg = Math.max(0, Math.min(999, nextSet.kg));
    nextSet.reps = Math.max(0, Math.min(300, Math.round(nextSet.reps)));
    const updated = {
      ...active,
      metadata: { gym: { ...active.metadata.gym, sets: { ...active.metadata.gym.sets, [id]: current.map((item, i) => i === index ? nextSet : item) } } },
    };
    setActive(updated);
    if (change.done === true) { setRest(90); setRestRunning(true); }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // A marked set is a durable event: persist it immediately. Numeric edits can
    // be debounced while the user is still typing, then the next mark saves all.
    if ("done" in change) void persist(updated);
    else saveTimer.current = setTimeout(() => { void persist(updated); }, 450);
  }

  async function begin() {
    if (working) return;
    setWorking(true); setError("");
    try {
      const gym = initialLog(routineCode, mode, entries);
      const response = await fetch("/api/life/entries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "health", title: "Entrenamiento " + routineCode + " · Forus Forjas",
          note: routine.title, entry_date: today(), amount: null, category: "entreno",
          status: "in_progress", metadata: { gym },
        }),
      });
      const body = await response.json() as { entry?: GymEntry; error?: string };
      if (!response.ok || !body.entry || !isGym(body.entry)) throw new Error(body.error || "No se pudo iniciar la sesión");
      setEntries(all => [body.entry as GymEntry, ...all]);
      setActive(body.entry);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al iniciar"); }
    finally { setWorking(false); }
  }

  async function finish() {
    if (!active || working || !doneSets) return;
    setWorking(true); setError("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const finished: GymLog = { ...active.metadata.gym, finishedAt: new Date().toISOString() };
    try {
      await writeQueue.current.catch(() => {});
      const response = await fetch("/api/life/entries", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id, status: "completed", metadata: { gym: finished },
          note: `${setCount(finished)} series · ${number(sessionVolume(finished))} kg de volumen`,
        }),
      });
      const body = await response.json() as { entry?: GymEntry; error?: string };
      if (!response.ok || !body.entry) throw new Error(body.error || "No se pudo finalizar");
      setEntries(all => [body.entry as GymEntry, ...all.filter(item => item.id !== active.id)]);
      setActive(null);
      setRest(0); setRestRunning(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al finalizar"); }
    finally { setWorking(false); setSaving(false); }
  }

  return <main className={styles.page}>
    <div className={styles.canvas}>
      <header className={styles.topbar}>
        <Link className={styles.back} href="/life?section=health"><ArrowLeft size={17}/><span>LifeOS</span></Link>
        <div className={styles.brand}><span className={styles.brandIcon}><Dumbbell size={17}/></span><strong>GYM<span> / LIFE</span></strong></div>
        <div className={styles.place}><span/>FORUS FORJAS</div>
      </header>

      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>TU PROGRAMA · 24 SEMANAS</span>
          <h1>Una sesión más.<br/><em>Una versión mejor.</em></h1>
          <p>Ganar músculo, reducir cintura y convertir el entrenamiento en hábito. Sin días fijos, sin competir con nadie.</p>
        </div>
        <div className={styles.heroGlyph}><Dumbbell size={54} strokeWidth={1.35}/></div>
      </section>

      {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setError("")}>Cerrar</button>
        {error.includes("Inicia sesión") && <Link href="/login">Ir al acceso</Link>}</div>}

      {loading ? <div className={styles.loading}><LoaderCircle size={22} className={styles.spin}/> Cargando tus entrenamientos…</div> :
        <div className={styles.layout}>
          <div className={styles.primaryColumn}>
            <section className={styles.sessionCard}>
              <div className={styles.cardTopline}><span>{active ? "SESIÓN EN CURSO" : "SIGUIENTE ENTRENAMIENTO"}</span><span>ROTACIÓN A → B → C</span></div>
              <div className={styles.sessionTitleRow}>
                <div className={styles.dayLetter} style={{ background: routine.accent }}>{routine.code}</div>
                <div><h2>{routine.title}</h2><p>{routine.subtitle}</p></div>
              </div>
              {active ? <>
                <div className={styles.progressText}><span>{doneSets} de {totalSets} series</span><strong>{progress}%</strong></div>
                <div className={styles.progressTrack}><div style={{ width: progress + "%" }}/></div>
                <div className={styles.sessionStatus}><span className={styles.liveDot}/>{saving ? "Guardando cambios…" : "Progreso sincronizado con LifeOS"}<span>{active.metadata.gym.mode === "express" ? "MODO EXPRÉS" : "MODO COMPLETO"}</span></div>
              </> : <>
                <div className={styles.modeToggle} role="group" aria-label="Duración del entrenamiento">
                  <button className={mode === "express" ? styles.selected : ""} type="button" aria-pressed={mode === "express"} onClick={() => setMode("express")}><Clock3 size={16}/> Exprés <small>35–45 min</small></button>
                  <button className={mode === "full" ? styles.selected : ""} type="button" aria-pressed={mode === "full"} onClick={() => setMode("full")}><Dumbbell size={16}/> Completo <small>50–65 min</small></button>
                </div>
                <button className={styles.startButton} disabled={working || error.includes("Inicia sesión")} type="button" onClick={() => void begin()}>
                  {working ? <LoaderCircle className={styles.spin} size={20}/> : <Play fill="currentColor" size={18}/>} Empezar sesión {routine.code} <ArrowRight size={18}/>
                </button>
                <p className={styles.cardNote}>Los kilos sugeridos son solo puntos de partida. Busca acabar cada serie pudiendo hacer 2–3 repeticiones más.</p>
              </>}
            </section>

            <div className={styles.sectionLabel}><span>{active ? "REGISTRA CADA SERIE" : "QUÉ TOCA HOY"}</span><small>{sessionExercises.length} ejercicios</small></div>
            <p className={styles.visualNote}><ImageIcon size={14}/> Toca la foto para identificar la máquina y ver cómo se usa. Referencias orientativas: el modelo de Forus puede ser distinto.</p>
            <div className={styles.exerciseList}>
              {sessionExercises.map((exercise, index) => {
                const sets = gymLog?.sets[exercise.id] ?? [];
                const marked = sets.filter(set => set.done).length;
                const guide = GYM_GUIDES[exercise.id];
                const guideOpen = openGuideId === exercise.id;
                const machine = !guide?.equipment.includes("sin máquina") && !guide?.equipment.includes("Esterilla");
                return <article key={exercise.id} className={styles.exerciseCard}>
                  <div className={styles.exerciseHeader}>
                    <span className={styles.exerciseNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <div className={styles.exerciseName}>
                      <div className={styles.exerciseMeta}><small>{exercise.group.toUpperCase()}</small>{active && <span className={styles.exerciseCount}>{marked}/{exercise.sets}</span>}</div>
                      <h3>{exercise.name}</h3><p>{exercise.sets} series · {exercise.reps} reps · Referencia {exercise.range}</p>
                    </div>
                    <button type="button" className={styles.guideTrigger} aria-expanded={guideOpen} aria-controls={`gym-guide-${exercise.id}`}
                      onClick={() => setOpenGuideId(guideOpen ? null : exercise.id)}>
                      <span className={styles.guideThumbFrame}>
                        {guide?.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={commonsImageUrl(guide.photo)} alt="" loading="lazy"/> : <ImageIcon size={26}/>}
                      </span>
                      <span>{guideOpen ? "OCULTAR" : machine ? "VER MÁQUINA" : "VER TÉCNICA"}<ChevronDown size={12}/></span>
                    </button>
                  </div>
                  {guideOpen && guide && <div id={`gym-guide-${exercise.id}`} className={styles.guidePanel}>
                    <div className={styles.guideHeading}><span>GUÍA VISUAL</span><strong>{guide.equipment}</strong></div>
                    {guide.photo || guide.demo ? <div className={styles.guidePhotos}>
                      {guide.photo && <GuidePhoto visual={guide.photo} label={guide.photo.kind === "diagram" ? "POSICIÓN / MOVIMIENTO" : "REFERENCIA VISUAL"}/>}
                      {guide.demo && <GuidePhoto visual={guide.demo} label={guide.demo.kind === "diagram" ? "POSICIÓN / MOVIMIENTO" : "ASÍ SE HACE"}/>}
                    </div> : <div className={styles.guideNoPhoto}><Activity size={20}/> Ejercicio de suelo: sigue los pasos de colocación y movimiento.</div>}
                    <div className={styles.guideHow}>
                      <div><span>01 · RECONÓCELA</span><p>{guide.identify}</p></div>
                      <div><span>02 · COLÓCATE</span><p>{guide.setup}</p></div>
                      <div><span>03 · EJECUTA</span><p>{guide.movement}</p></div>
                    </div>
                    <div className={styles.guideWarning}><strong>OJO CON ESTO</strong><p>{guide.caution}</p></div>
                    <p className={styles.guideCreditNote}>Fotos orientativas de Wikimedia Commons, con autoría y licencia enlazadas. Si no reconoces la máquina o sus ajustes, pide al monitor que te la enseñe antes de cargar peso.</p>
                  </div>}
                  {active ? <>
                    <div className={styles.setHead}><span>SERIE</span><span>PESO (KG)</span><span>REPS / SEG</span><span>HECHO</span></div>
                    <div className={styles.setList}>{sets.map((set, i) => <div key={i} className={styles.setRow + (set.done ? " " + styles.setDone : "")}>
                      <strong>{i + 1}</strong>
                      <div className={styles.weightControl}>
                        {exercise.step > 0 && <button aria-label="Bajar peso" type="button" onClick={() => updateSet(exercise.id, i, { kg: Math.max(0, set.kg - exercise.step) })}><Minus size={13}/></button>}
                        <input type="number" aria-label={`Peso en kilos, serie ${i + 1}`} min="0" step={exercise.step || 1} value={set.kg} onChange={event => updateSet(exercise.id, i, { kg: Number(event.target.value) })}/>
                        {exercise.step > 0 && <button aria-label="Subir peso" type="button" onClick={() => updateSet(exercise.id, i, { kg: set.kg + exercise.step })}><Plus size={13}/></button>}
                      </div>
                      <input className={styles.repInput} type="number" aria-label={`Repeticiones o segundos, serie ${i + 1}`} min="0" max="300" value={set.reps} onChange={event => updateSet(exercise.id, i, { reps: Number(event.target.value) })}/>
                      <button className={styles.checkSet} type="button" aria-pressed={set.done} aria-label={set.done ? "Desmarcar serie" : "Marcar serie terminada"} onClick={() => updateSet(exercise.id, i, { done: !set.done })}><Check size={20}/></button>
                    </div>)}</div>
                  </> : <p className={styles.exerciseHint}>{exercise.hint}</p>}
                </article>;
              })}
            </div>

            {active && <section className={styles.finishPanel}>
              <div><strong>¿Entrenamiento terminado?</strong><span>Se guardará automáticamente en Salud y en tu historial.</span></div>
              <button type="button" disabled={!doneSets || working} onClick={() => void finish()}>{working ? "Guardando…" : "Terminar sesión"}<CheckCircle2 size={19}/></button>
            </section>}
          </div>

          <aside className={styles.sideColumn}>
            <div className={styles.statGrid}>
              <div className={styles.statCard}><span>ESTA SEMANA</span><strong>{lastWeek}<small> / 3</small></strong><p>Sesiones completadas</p></div>
              <div className={styles.statCard}><span>ÚLTIMOS 28 DÍAS</span><strong>{lastFourWeeks}</strong><p>Entrenamientos</p></div>
            </div>
            {active && <section className={styles.restCard}>
              <div className={styles.sideHeading}><Clock3 size={17}/> DESCANSO ENTRE SERIES</div>
              <strong>{String(Math.floor(rest / 60)).padStart(2, "0")}:{String(rest % 60).padStart(2, "0")}</strong>
              <div className={styles.restActions}><button type="button" onClick={() => { setRest(90); setRestRunning(true); }}><RotateCcw size={15}/> 1:30</button><button type="button" onClick={() => setRestRunning(value => !value)}>{restRunning ? <Pause size={15}/> : <Play size={15}/>} {restRunning ? "Pausa" : "Continuar"}</button></div>
            </section>}
            <section className={styles.graphCard}>
              <div className={styles.sideHeading}><TrendingUp size={17}/> PROGRESIÓN DE FUERZA</div>
              <label className={styles.graphSelect}>Ejercicio <ChevronDown size={15}/><select aria-label="Ejercicio a comparar" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
                {chartExercises.length ? chartExercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>) : <option value="chest_press">Press de pecho</option>}
              </select></label>
              {graph.length > 1 ? <div className={styles.chart}><ResponsiveContainer width="100%" height="100%">
                <LineChart data={graph} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#7b867c" }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#7b867c" }} domain={["dataMin - 2", "dataMax + 2"]}/>
                  <Tooltip formatter={(value) => [String(value) + " kg", "Mejor serie"]}/>
                  <Line type="monotone" dataKey="kg" stroke="#628b41" strokeWidth={3} dot={{ fill: "#b7ff4a", stroke: "#486738", strokeWidth: 1.5, r: 4 }} activeDot={{ r: 6 }}/>
                </LineChart>
              </ResponsiveContainer></div> : <div className={styles.emptyChart}><Activity size={25}/><span>Tras dos sesiones con el mismo ejercicio verás cómo evolucionan tus kilos.</span></div>}
            </section>
            <section className={styles.historyCard}>
              <div className={styles.sideHeading}><Activity size={17}/> HISTORIAL</div>
              {completed.length ? <div className={styles.historyList}>{completed.slice(0, 7).map(entry => <div className={styles.historyRow} key={entry.id}>
                <span className={styles.historyCode} style={{ background: getRoutine(entry.metadata.gym.routine).accent }}>{entry.metadata.gym.routine}</span>
                <span><strong>{getRoutine(entry.metadata.gym.routine).title}</strong><small>{dateText(entry.entry_date)} · {setCount(entry.metadata.gym)} series</small></span>
                <CheckCircle2 size={18}/>
              </div>)}</div> : <div className={styles.historyEmpty}>Tu primer entrenamiento aparecerá aquí. El progreso empieza con una serie.</div>}
            </section>
            <div className={styles.disclaimer}><Check size={15}/> Todo se guarda en el mismo LifeOS. La carga real depende de cada máquina de Forus y de tu técnica.</div>
          </aside>
        </div>}
    </div>
  </main>;
}
