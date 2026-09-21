export async function compressListingImage(file: File, maxSide = 1800, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('CANVAS_UNAVAILABLE');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('IMAGE_ENCODE_FAILED'))), 'image/webp', quality),
  );
  if (blob.type !== 'image/webp') throw new Error('Seu navegador não permite converter para WebP.');
  return new File([blob], `${crypto.randomUUID()}.webp`, { type: 'image/webp' });
}
