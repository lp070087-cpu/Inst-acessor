import type { EditorSlide } from "./project";
import { clampFraming, drawCrop, exportSize, imageGeometry } from "./image-crop";

export { imageGeometry };

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => { image.onload=()=>resolve(); image.onerror=()=>reject(new Error("Não foi possível abrir a imagem para exportação.")); image.src=url; });
  return image;
}

/**
 * Recorte REAL do arquivo: desenha o enquadramento aprovado num canvas com os
 * pixels nativos da área recortada (320–1440 px de largura, limites do
 * Instagram) e grava JPEG, formato exigido pela publicação de imagens.
 */
export async function exportEditedImage(slide: EditorSlide, aspect: number): Promise<File> {
  const image = await loadImage(slide.originalUrl);
  // Mesmo limite da prévia: a imagem sempre cobre o quadro, sem faixas vazias.
  const framing = clampFraming(image.naturalWidth, image.naturalHeight, aspect, slide.rotation, slide.framing);
  const size = exportSize(image.naturalWidth, image.naturalHeight, aspect, slide.rotation, framing.zoom);
  const canvas=document.createElement("canvas"); canvas.width=size.width; canvas.height=size.height;
  drawCrop(canvas, image, aspect, { ...slide, framing });
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Falha ao exportar a imagem.")),"image/jpeg",0.95));
  return new File([blob],`editada-${slide.id}.jpg`,{type:"image/jpeg"});
}
