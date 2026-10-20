import type { EditorSlide } from "./project";

/** Geometry is shared with the preview: cover after rotation, then zoom and frame-relative translation. */
export function imageGeometry(width: number, height: number, frameWidth: number, frameHeight: number, rotation: number, zoom: number) {
  const radians = rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
  // Cover the frame in the source's rotated coordinate system; prevents empty corners.
  const scale = Math.max((frameWidth*c + frameHeight*s)/width, (frameWidth*s + frameHeight*c)/height) * zoom;
  return { width: width*scale, height: height*scale, radians };
}
export async function exportEditedImage(slide: EditorSlide, ratio: string): Promise<File> {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => { image.onload=()=>resolve(); image.onerror=()=>reject(new Error("Não foi possível abrir a imagem para exportação.")); image.src=slide.originalUrl; });
  const [rw,rh]=ratio.split(":").map(Number);
  const canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=Math.round(1080*rh/rw);
  const ctx=canvas.getContext("2d"); if(!ctx) throw new Error("Exportação de imagem indisponível neste navegador.");
  const g=imageGeometry(image.naturalWidth,image.naturalHeight,canvas.width,canvas.height,slide.rotation,slide.framing.zoom);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width*(0.5+slide.framing.offsetX),canvas.height*(0.5+slide.framing.offsetY)); ctx.rotate(g.radians);
  ctx.filter=`brightness(${slide.brightness}) contrast(${slide.contrast})`;
  ctx.drawImage(image,-g.width/2,-g.height/2,g.width,g.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Falha ao exportar a imagem.")),"image/jpeg",0.94));
  return new File([blob],`editada-${slide.id}.jpg`,{type:"image/jpeg"});
}
