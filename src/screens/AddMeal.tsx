import React, { useState, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  ArrowLeft,
  Camera,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  Plus,
} from "lucide-react";
import { compressImage, createThumbnail } from "../utils/image";
import { analyzeMealImage } from "../utils/ai";
import { v4 as uuidv4 } from "uuid";

export function AddMeal({ onComplete }: { onComplete: () => void }) {
  const { settings, addMeal, favorites, meals } = useStore();
  const [images, setImages] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    aiThoughts: string;
  } | null>(null);
  const [showThoughts, setShowThoughts] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    try {
      // Сжимаем фото сильнее (640x640) для быстрого анализа ИИ
      const compressedImages = await Promise.all(
        files.map((f) => compressImage(f, 640, 640)),
      );

      setImages((prev) => {
        const combined = [...prev, ...compressedImages];
        if (combined.length > 10) {
          setTimeout(
            () =>
              setError(
                "Загружено первые 10 фото (это максимум для одного блюда)",
              ),
            0,
          );
          return combined.slice(0, 10);
        }
        setTimeout(() => setError(null), 0);
        return combined;
      });
      setResult(null);
    } catch (err) {
      setError("Ошибка при обработке фото");
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (images.length === 0 && !userInput.trim()) {
      setError("Добавьте фото или опишите еду текстом");
      return;
    }
    if (!settings.apiKey) {
      setError("Укажите API ключ Gemini в настройках");
      return;
    }

    setIsAnalyzing(true);
    setLoadingProgress(0);
    setError(null);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setLoadingProgress(Math.round(currentProgress));
    }, 200);

    // Prepare recent meals context
    const recentMealsText = meals
      .slice(0, 10)
      .map(
        (m) =>
          `- [${m.date} ${m.time}]: ${m.name} (${m.calories} ккал, Б:${m.protein} Ж:${m.fat} У:${m.carbs})`,
      )
      .join("\n");

    try {
      const { result: aiResult, aiThoughts } = await analyzeMealImage(
        settings.apiKey,
        images,
        settings.userContext,
        userInput,
        recentMealsText,
      );
      setResult({ ...aiResult, aiThoughts });
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при анализе");
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);

    try {
      // Create thumbnails to save space in localStorage, only if images exist
      const thumbnails =
        images.length > 0
          ? await Promise.all(images.map((img) => createThumbnail(img)))
          : [];

      const now = new Date();
      addMeal({
        id: uuidv4(),
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        name: result.name,
        calories: result.calories,
        protein: result.protein,
        fat: result.fat,
        carbs: result.carbs,
        ai_thoughts: result.aiThoughts,
        images: thumbnails,
        image: thumbnails[0] || undefined, // For backward compatibility
      });
      onComplete();
    } catch (err) {
      setError("Ошибка при сохранении фото");
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onComplete}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900">Добавить еду</h2>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* Image Capture / Preview */}
          {images.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="bg-white rounded-[20px] shadow-sm p-5 flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all aspect-square"
              >
                <Camera className="w-8 h-8 text-emerald-500" />
                <span className="text-xs font-medium text-gray-700">
                  Камера
                </span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="bg-white rounded-[20px] shadow-sm p-5 flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all aspect-square"
              >
                <ImageIcon className="w-8 h-8 text-emerald-500" />
                <span className="text-xs font-medium text-gray-700">
                  Галерея
                </span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] shadow-sm p-3">
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x hide-scrollbar">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative flex-shrink-0 w-28 h-28 snap-start"
                  >
                    <img
                      src={img}
                      alt={`Preview ${idx}`}
                      className="w-full h-full object-cover rounded-[12px]"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 bg-black/50 text-white p-1 rounded-full backdrop-blur-md hover:bg-red-500/80 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-shrink-0 w-28 h-28 rounded-[12px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 hover:border-emerald-400 hover:bg-emerald-50 transition-all snap-start"
                >
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-[10px] font-medium text-gray-500">
                    Добавить
                  </span>
                </button>
              </div>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            ref={cameraInputRef}
            onChange={handleImageCapture}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={galleryInputRef}
            onChange={handleImageCapture}
          />

          {/* User Input always visible */}
          <div className="bg-white rounded-[20px] p-5 shadow-sm">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {images.length > 0
                ? "Уточнение (необязательно)"
                : "Опишите еду текстом"}
            </label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              rows={images.length > 0 ? 2 : 3}
              className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
              placeholder={
                images.length > 0
                  ? "Что на тарелке? Уточните вес или состав..."
                  : "Например: Овсянка 200г с бананом и кофе с молоком"
              }
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-[12px] text-xs">
              {error}
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (images.length === 0 && !userInput.trim())}
            className="relative w-full bg-emerald-500 text-white text-sm font-medium py-3 rounded-[12px] hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 overflow-hidden disabled:opacity-70 disabled:active:scale-100 disabled:hover:bg-emerald-500"
          >
            {isAnalyzing && (
              <div
                className="absolute left-0 top-0 bottom-0 bg-emerald-600 transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            )}
            <div className="relative flex items-center gap-2 z-10">
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Оценка... {loadingProgress}%
                </>
              ) : images.length > 0 ? (
                "Распознать фото"
              ) : (
                "Подсчитать по тексту"
              )}
            </div>
          </button>

          {/* Favorites List */}
          {!isAnalyzing && images.length === 0 && favorites.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3 px-1">
                Избранное
              </h3>
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      const now = new Date();
                      addMeal({
                        id: uuidv4(),
                        date: now.toISOString().split("T")[0],
                        time: now.toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                        name: fav.name,
                        calories: fav.calories,
                        protein: fav.protein,
                        fat: fav.fat,
                        carbs: fav.carbs,
                        ai_thoughts: "Добавлено из избранного",
                      });
                      onComplete();
                    }}
                    className="w-full bg-white rounded-[16px] p-4 shadow-sm flex items-center justify-between text-left hover:bg-gray-50 active:scale-[0.98] transition-all border border-transparent hover:border-gray-100"
                  >
                    <div>
                      <h4 className="font-medium text-sm text-gray-900">
                        {fav.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Б: {fav.protein}г • Ж: {fav.fat}г • У: {fav.carbs}г
                      </p>
                    </div>
                    <div className="text-emerald-600 font-medium text-sm">
                      {fav.calories} ккал
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Result Screen */
        <div className="space-y-5">
          <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-4">
            <input
              type="text"
              value={result.name}
              onChange={(e) => setResult({ ...result, name: e.target.value })}
              className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 pb-1.5 focus:outline-none focus:border-emerald-500"
            />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
                  Калории
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={result.calories}
                    onChange={(e) =>
                      setResult({ ...result, calories: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-[12px] bg-emerald-50 text-emerald-700 font-semibold text-base focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600/50 text-xs">
                    ккал
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
                  Белки
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={result.protein}
                    onChange={(e) =>
                      setResult({ ...result, protein: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-[12px] bg-blue-50 text-blue-700 font-medium text-sm focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600/50 text-xs">
                    г
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
                  Жиры
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={result.fat}
                    onChange={(e) =>
                      setResult({ ...result, fat: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-[12px] bg-amber-50 text-amber-700 font-medium text-sm focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600/50 text-xs">
                    г
                  </span>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">
                  Углеводы
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={result.carbs}
                    onChange={(e) =>
                      setResult({ ...result, carbs: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 rounded-[12px] bg-purple-50 text-purple-700 font-medium text-sm focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-600/50 text-xs">
                    г
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Thoughts Accordion */}
          <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
            <button
              onClick={() => setShowThoughts(!showThoughts)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-gray-700">
                Как посчитал ИИ
              </span>
              {showThoughts ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {showThoughts && (
              <div className="px-5 pb-5 pt-1.5 text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-100">
                {result.aiThoughts}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setResult(null)}
              className="flex-1 bg-white text-gray-700 text-sm font-medium py-3 rounded-[12px] shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] bg-emerald-500 text-white text-sm font-medium py-3 rounded-[12px] hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Добавить"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
