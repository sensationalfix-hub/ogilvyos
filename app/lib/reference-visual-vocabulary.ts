// Labels are hypotheses derived from pixels, not factual scene descriptions.
// English CLIP prompts improve model alignment; Spanish labels keep Library coherent.
export type VisualGroup = "composición" | "luz y color" | "lenguaje" | "motivos";
export type VisualLabel = { id: string; name: string; group: VisualGroup; prompt: string };
export const VISUAL_LABELS: VisualLabel[] = [
 {id:"plano-detalle",name:"plano detalle",group:"composición",prompt:"a macro photograph, an extreme close-up of a small detail"},
 {id:"primer-plano",name:"primer plano",group:"composición",prompt:"a cinematic close-up shot of a face"},
 {id:"plano-general",name:"plano general",group:"composición",prompt:"a very wide establishing shot showing the entire scene"},
 {id:"cenital",name:"vista cenital",group:"composición",prompt:"a top down overhead bird's eye view"},
 {id:"contrapicado",name:"contrapicado",group:"composición",prompt:"a dramatic low angle shot looking upwards"},
 {id:"simetria",name:"simetría",group:"composición",prompt:"a perfectly symmetrical centered image composition"},
 {id:"espacio-negativo",name:"espacio negativo",group:"composición",prompt:"a minimalist image with a lot of empty negative space"},
 {id:"gran-angular",name:"gran angular",group:"composición",prompt:"a distorted wide angle fisheye lens photograph"},
 {id:"contraluz",name:"contraluz",group:"luz y color",prompt:"strong backlighting, a silhouetted subject against bright light"},
 {id:"hora-dorada",name:"hora dorada",group:"luz y color",prompt:"warm sunset golden hour sunlight"},
 {id:"noche",name:"noche",group:"luz y color",prompt:"a dark scene at night"},
 {id:"alto-contraste",name:"alto contraste",group:"luz y color",prompt:"dramatic chiaroscuro lighting with deep shadows"},
 {id:"monocromo",name:"monocromo",group:"luz y color",prompt:"a monochrome black and white picture"},
 {id:"saturacion",name:"colores saturados",group:"luz y color",prompt:"bright vibrant saturated colors"},
 {id:"luz-suave",name:"luz suave",group:"luz y color",prompt:"soft natural diffused daylight and pastel colors"},
 {id:"neon",name:"luces de neón",group:"luz y color",prompt:"neon pink and blue artificial lighting"},
 {id:"fotografia",name:"fotografía",group:"lenguaje",prompt:"a realistic professional photograph"},
 {id:"ilustracion",name:"ilustración",group:"lenguaje",prompt:"a hand-drawn illustration or painting"},
 {id:"collage",name:"collage",group:"lenguaje",prompt:"a mixed media paper cutout collage"},
 {id:"render-3d",name:"render 3D",group:"lenguaje",prompt:"a three dimensional CGI render"},
 {id:"tipografia",name:"tipografía",group:"lenguaje",prompt:"a typography-led graphic design poster with prominent letters"},
 {id:"surrealismo",name:"surrealismo visual",group:"lenguaje",prompt:"surreal dreamlike impossible visual imagery"},
 {id:"cine",name:"lenguaje cinematográfico",group:"lenguaje",prompt:"a cinematic film still"},
 {id:"documental",name:"estética documental",group:"lenguaje",prompt:"a candid documentary photojournalism photograph"},
 {id:"ciudad",name:"ciudad",group:"motivos",prompt:"a city street with urban buildings"},
 {id:"naturaleza",name:"naturaleza",group:"motivos",prompt:"a wild natural landscape with forests and plants"},
 {id:"rostros",name:"rostros",group:"motivos",prompt:"a photograph focusing on a human face"},
 {id:"multitud",name:"multitud",group:"motivos",prompt:"a large crowd of people"},
 {id:"deporte",name:"deporte",group:"motivos",prompt:"athletes playing competitive sports"},
 {id:"arquitectura",name:"arquitectura",group:"motivos",prompt:"architectural photography of a building"},
 {id:"siluetas",name:"siluetas",group:"motivos",prompt:"the silhouettes of people or objects"},
 {id:"reflejos",name:"reflejos",group:"motivos",prompt:"a clear reflection in glass mirrors or water"},
 {id:"objeto-gigante",name:"objeto sobredimensionado",group:"motivos",prompt:"a gigantic oversized everyday object next to tiny people"},
 {id:"desierto",name:"desierto",group:"motivos",prompt:"a sandy desert landscape"},
 {id:"animales",name:"animales",group:"motivos",prompt:"an animal as the main subject"},
 {id:"agua",name:"agua",group:"motivos",prompt:"water ocean or a lake as the main subject"},
];
export const VISUAL_TAG_PREFIX = "visual:";
export const visualTag = (id: string) => VISUAL_TAG_PREFIX + id;
export function acceptedVisualIds(input: unknown): string[] {
 if(!Array.isArray(input) || input.length>8 || input.some(x=>typeof x!=="string"))throw Error("Selección visual no válida.");
 const known=new Set(VISUAL_LABELS.map(label=>label.id));
 if(input.some(id=>!known.has(id)))throw Error("Concepto visual no reconocido.");
 return [...new Set(input)];
}
