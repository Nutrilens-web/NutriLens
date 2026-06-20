// Утилиты обработки изображений.
//
// Главное назначение — подготовить фото еды для распознавания калорий.
// Точность модели напрямую зависит от того, что она «видит», поэтому
// здесь важно:
//   1. Сохранять корректную ориентацию (EXIF orientation).
//      Телефоны часто пишут поворот в EXIF-метаданных, а canvas при перерисовке
//      эти метаданные сбрасывает — модель получала перевёрнутое фото и теряла
//      точность. Теперь используем createImageBitmap с imageOrientation:
//      'from-image' (нативно применяет EXIF-поворот), с откатом к Image для
//      старых браузеров.
//   2. Подавать достаточно высокое разрешение (по умолчанию 1536px) — мелкие
//      детали и текст на упаковках должны быть читаемы.
//   3. Готовить и полноразмерное фото (для ИИ), и миниатюру (для хранения в
//      истории) за ОДИН decode источника, а не два — раньше compressImage
//      декодировала файл, а createThumbnail заново декодировала уже сжатый
//      base64. Теперь prepareImage декодирует bitmap один раз и рисует два
//      canvas разного размера из него.

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

// Декодирует источник один раз и рисует два canvas: full (для ИИ) и thumb
// (для истории). Возвращает оба как data URL. Это заменяет прежнюю связку
// compressImage + createThumbnail, где base64 декодировался дважды.
function renderBoth(
  source: ImageBitmap | HTMLImageElement,
  fullSize: { width: number; height: number },
  thumbSize: { width: number; height: number },
): { full: string; thumb: string } {
  const fullCanvas = drawToCanvas(source, fullSize.width, fullSize.height);
  const thumbCanvas = drawToCanvas(source, thumbSize.width, thumbSize.height);
  return {
    // 0.85 — баланс между читаемостью деталей и размером запроса.
    full: fullCanvas.toDataURL('image/jpeg', 0.85),
    // Миниатюра хранится в истории и не нужна в высоком качестве.
    thumb: thumbCanvas.toDataURL('image/jpeg', 0.6),
  };
}

// Готовит полноразмерное фото + миниатюру за один decode файла.
export function prepareImage(
  file: File,
  fullMax = 1536,
  fullMaxH = 1536,
  thumbMax = 256,
  thumbMaxH = 256,
): Promise<{ full: string; thumb: string }> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then((bitmap) => {
      const fullSize = fitInside(bitmap.width, bitmap.height, fullMax, fullMaxH);
      const thumbSize = fitInside(bitmap.width, bitmap.height, thumbMax, thumbMaxH);
      const result = renderBoth(bitmap, fullSize, thumbSize);
      bitmap.close();
      return result;
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
        const fullSize = fitInside(img.width, img.height, fullMax, fullMaxH);
        const thumbSize = fitInside(img.width, img.height, thumbMax, thumbMaxH);
        resolve(renderBoth(img, fullSize, thumbSize));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

// Обратная совместимость: только полноразмерное фото (используется там, где
// миниатюра не нужна). Внутри переиспользует prepareImage и отбрасывает thumb.
export function compressImage(file: File, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  return prepareImage(file, maxWidth, maxHeight).then((r) => r.full);
}

// Обратная совместимость: миниатюра из готового data URL (для старых вызовов).
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
