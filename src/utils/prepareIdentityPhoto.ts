/** Resize locally before sending; never upload the camera's metadata. */
export async function prepareIdentityPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png'].includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('invalid_photo');
  const image = await createImageBitmap(file, {imageOrientation:'from-image'});
  try {
    if (!image.width || !image.height || image.width * image.height > 50_000_000) throw new Error('invalid_photo');
    const scale = Math.min(1, 2000 / Math.max(image.width,image.height));
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d'); if(!context) throw new Error('invalid_photo');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    for (const quality of [0.88,0.75,0.6]) {
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if (blob && blob.size <= 2097152) return blob;
    }
    throw new Error('invalid_photo');
  } finally {image.close();}
}
