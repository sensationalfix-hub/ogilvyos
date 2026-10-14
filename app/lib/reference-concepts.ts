/**
 * Reference context: deterministic concepts from user text and source metadata.
 * Never pretends to interpret pixels, audio, or video frames.
 */
const themes: Array<{name:string;match:RegExp}> = [
 {name:"western",match:/\b(western|cowboy|vaquer[oa]s?|saloon|far west|spaghetti western)\b/i},
 {name:"mitología",match:/\b(mitolog[ií]a|mythology|myth|nornas?|dioses|leyenda|legend)\b/i},
 {name:"destino",match:/\b(destino|inevitable|fate|destiny|profec[ií]a|prophecy|predestinad[oa])\b/i},
 {name:"ritual",match:/\b(ritual(?:es)?|ceremonia|liturgia|ceremony)\b/i},
 {name:"transformación",match:/\b(metamorfosis|transformaci[oó]n|transformation|metamorphosis|evoluci[oó]n)\b/i},
 {name:"humor",match:/\b(humor|comedia|comedy|absurd[oa]|ir[oó]nic[oa]|parodia|parody)\b/i},
 {name:"surrealismo",match:/\b(surrealismo|surreal(?:ist|ism)?|on[ií]rico|dreamlike|absurdo visual)\b/i},
 {name:"escala",match:/\b(monumental|gigante|gigantic|massive|colossal|colosal|sobrehumana|oversized)\b/i},
 {name:"memoria",match:/\b(memoria|memory|historia|history|legado|heritage|nostalgia|recuerdo)\b/i},
 {name:"deporte",match:/\b(deporte|sport|football|f[uú]tbol|basketball|atleta|athlete|nike|adidas)\b/i},
 {name:"música",match:/\b(m[uú]sica|music|soundtrack|canci[oó]n|song|album|disco|sonido|sound)\b/i},
 {name:"cine",match:/\b(cine|cinema|cinematic|pel[ií]cula|movie|film|filmmaking)\b/i},
 {name:"fotografía",match:/\b(fotograf[ií]a|photography|photographic|camera|c[aá]mara)\b/i},
 {name:"tipografía",match:/\b(tipograf[ií]a|typography|lettering|fuente|font|typeface)\b/i},
 {name:"animación",match:/\b(animaci[oó]n|animation|motion graphics|stop.motion)\b/i},
 {name:"naturaleza",match:/\b(naturaleza|nature|bosque|forest|desierto|desert|plantas|plants)\b/i},
 {name:"rebelión",match:/\b(rebeli[oó]n|rebellion|rebelde|rebel|revoluci[oó]n|revolution)\b/i},
 {name:"arquitectura",match:/\b(arquitectura|architecture|edificio|building|brutalismo|brutalist)\b/i},
 {name:"publicidad",match:/\b(publicidad|advertising|campaign|campa[nñ]a|commercial|spot)\b/i},
 {name:"identidad",match:/\b(identidad|identity|branding|marca|brand|logo)\b/i},
 {name:"ambición",match:/\b(ambici[oó]n|ambition|hambre de|hunger|obsesi[oó]n|obsession)\b/i},
 {name:"futuro",match:/\b(futuro|future|ma[nñ]ana|tomorrow|porvenir)\b/i},
 {name:"contraste",match:/\b(contraste|contrast|opuestos|opposites|paradoja|paradox)\b/i},
];
const stop=new Set([
 "sobre","entre","desde","para","porque","tambien","cuando","donde","hasta","dentro","fuera","mucho","mucha","algunas","alguna","todos","todas","esta","este","estos","estas","esto","that","these","those","their","there","about","after","before","which","where","while","would","could","should","with","from","some","this","your","https","www","com","video","videos","image","images","video","referencia","reference","descubre","descubrir","conoce","official","oficial","disponible","ahora","watch","subscribe","channel","follow","website","pinterest","youtube","spotify","vimeo","more","more","story","explore","learn","click","online"
]);
function normalized(text:string){return text.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
export function inferredConcepts(title:string,description:string,limit=9):string[]{
 const evidence=(title+" "+description).slice(0,5000);
 const signals=themes.filter(theme=>theme.match.test(evidence)).map(theme=>theme.name);
 const tokens=normalized(evidence).match(/[a-z]{5,}/g)||[];
 const freq=new Map<string,number>();
 for(const token of tokens){
  if(stop.has(token) || signals.some(signal=>normalized(signal)===token))continue;
  freq.set(token,(freq.get(token)||0)+1);
 }
 const keywords=[...freq].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,Math.max(0,limit-signals.length));
 return [...new Set([...signals,...keywords])].slice(0,limit);
}
export function cleanSourceDescription(raw:string):string {
 const plain=raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,1100);
 if(plain.length<28 || /^(?:home|inicio|index|welcome|bienvenido|you need to|enable javascript)/i.test(plain))return "";
 return plain;
}
