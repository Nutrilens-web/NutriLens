// Утилиты обработки изображений.
//
// Главное назначение compressImage — подготовить фото еды для распознавания
// калорий. Точность модели напрямую зависит от того, что она «видит», поэтому
// здесь важно:
//   1. Сохранять корректную ориентацию (EXIF orientation).
//      Телефоны часто пишут поворот в EXIF-метаданных, а canvas при перерисовке
//      эти метаданные сбрасывает — модель получала перевёрнутое фото и теряла
//      точность. Теперь используем createImageBitmap с imageOrientation:
//      'from-image' (нативно применяет EXIF-поворот), с откатом к Image для
//      старых браузеров.
//   2. Подавать достаточно высокое разрешение (по умолчанию 1536px) — мелкие
//      детали и текст на упаковках должны быть читаемы.

// Считаем итоговые размеры, вписывая в maxWidth×maxHeight с сохранением пропорций.
function fitInside(width: number, height: number, maxWidth: number, maxHeight: number) {
  let w = width;
  let h = height;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  if (h > maxHeight) {
    w = Math.round((w * maxHeight) / h);
    h = maxHeight;
  }
  return { width: w, height: h };
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context is not available');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function compressImage(file: File, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  // Современный путь: createImageBitmap применяет EXIF-ориентацию сам,
  // если явно попросить. Это убирает главный источник «перевёрнутых» фото.
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((bitmap) => {
        const { width, height } = fitInside(bitmap.width, bitmap.height, maxWidth, maxHeight);
        const canvas = drawToCanvas(bitmap, width, height);
        bitmap.close();
        // 0.85 — баланс между читаемостью деталей и размером запроса.
        return canvas.toDataURL('image/jpeg', 0.85);
      });
  }

  // Откат для старых браузеров: классический FileReader + Image.
  // Здесь EXIF не применяется — лучшее, что можно сделать без зависимостей.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const { width, height } = fitInside(img.width, img.height, maxWidth, maxHeight);
        const canvas = drawToCanvas(img, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

export function createThumbnail(base64Image: string, maxWidth = 256, maxHeight = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      const { width, height } = fitInside(img.width, img.height, maxWidth, maxHeight);
      const canvas = drawToCanvas(img, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = (error) => reject(error);
  });
}
