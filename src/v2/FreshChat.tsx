import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Send, Loader2, Bot, Image as ImageIcon, X, Camera, ArrowLeft } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { compressImage } from '../utils/image';
import { getLocalDateString } from '../utils/date';
import Markdown from 'react-markdown';
import { motion } from 'motion/react';
import { haptic } from '../v2/haptics';

/* FreshChat — ИИ-диетолог в новом дизайне. Логика переписки идентична
   классике (история в store, systemInstruction с контекстом дня). */
export function FreshChat({ onBack }: { onBack?: () => void }) {
  const { settings, meals, chatHistory, saveChatHistory, clearChatHistory } = useStore();
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory, isLoading]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setIsLoading(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f, 1536, 1536)));
      setSelectedImages((prev) => {
        const combined = [...prev, ...compressed];
        return combined.length > 10 ? combined.slice(0, 10) : combined;
      });
    } catch (err) {
      console.error('Failed to compress images:', err);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => setSelectedImages((prev) => prev.filter((_, i) => i !== index));

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setError(null);
    haptic('medium');

    const newMessages = [...chatHistory, { role: 'user' as const, text: input, images: selectedImages }];
    saveChatHistory(newMessages);
    setInput('');
    setSelectedImages([]);
    setIsLoading(true);

    try {
      const ai = getAIForSettings(settings);
      const today = getLocalDateString();
      const todayMeals = meals.filter((m) => m.date === today);
      const systemContext = `Ты дружелюбный и профессиональный ИИ-диетолог.
Твоя цель — помогать пользователю, отвечать на вопросы о питании, давать советы, также можешь анализировать фото еды, которые пользователь прикрепляет к сообщениям.
Данные пользователя: цель ${settings.dailyGoal} ккал. Контекст: ${settings.userContext}.
Съедено сегодня: ${todayMeals.map((m) => m.name + ' (' + m.calories + 'ккал)').join(', ')} / За день: ${todayMeals.reduce((a, m) => a + m.calories, 0)} ккал.
Старайся давать короткие, ёмкие и поддерживающие ответы. НЕ ставь медицинских диагнозов и не назначай лечение — при подозрении на расстройство питания мягко рекомендуй обратиться к специалисту.`;

      const fullHistory = newMessages.map((m) => {
        const parts: any[] = [];
        if (m.images && m.images.length > 0) {
          m.images.forEach((img) => {
            const base64Data = img.split(',')[1];
            const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';'));
            parts.push({ inlineData: { data: base64Data, mimeType } });
          });
        }
        if (m.text) parts.push({ text: m.text });
        else if (parts.length > 0 && !m.text) parts.push({ text: 'Вот фото' });
        return { role: m.role, parts };
      });

      const response = await ai.models.generateContent({
        model: getModelForMode(settings.apiMode),
        contents: fullHistory,
        config: {
          systemInstruction: systemContext,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });
      const reply = response.text || 'Извините, не смог сформировать ответ.';
      saveChatHistory([...newMessages, { role: 'model', text: reply }]);
    } catch (err) {
      console.error(err);
      saveChatHistory([...newMessages, { role: 'model', text: 'Произошла ошибка. Проверьте API ключ или попробуйте позже.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-230px)] min-h-[420px] bg-surface rounded-[26px] shadow-card border border-line/40 overflow-hidden">
      {/* Шапка чата */}
      <div className="flex items-center gap-3 p-3.5 border-b border-line/60 shrink-0 bg-surface z-10 relative justify-between">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} className="p-1.5 -ml-1 text-ink-faint hover:text-ink bg-surface-2 rounded-full transition-colors" aria-label="Назад">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          )}
          <div className="bg-accent-soft p-2 rounded-full">
            <Bot className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h2 className="font-display text-[15px] font-bold text-ink leading-tight">ИИ-Диетолог</h2>
            <p className="text-[10px] text-ink-faint font-medium">Ваш персональный помощник</p>
          </div>
        </div>
        <button
          onClick={clearChatHistory}
          className="text-[11px] font-semibold text-ink-faint hover:text-danger transition-colors px-2.5 py-1.5 bg-surface-2 rounded-lg"
        >
          Очистить
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-canvas/40" ref={scrollContainerRef}>
        {error && <div className="bg-danger/10 text-danger text-[11px] p-2.5 rounded-xl mb-2 font-medium">{error}</div>}
        {chatHistory.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={
                'max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[13px] ' +
                (m.role === 'user'
                  ? 'bg-gradient-to-br from-accent to-accent-strong text-white rounded-br-md shadow-glow'
                  : 'bg-surface border border-line/60 text-ink rounded-bl-md shadow-soft')
              }
            >
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {m.images.map((img, idx) => (
                    <img key={idx} src={img} alt="attached" className="w-14 h-14 object-cover rounded-lg bg-white/20" />
                  ))}
                </div>
              )}
              {m.role === 'model' ? (
                <div className="prose prose-sm max-w-none text-ink prose-p:leading-snug prose-li:my-0 pb-1 text-[13px] [&_strong]:text-accent">
                  <Markdown>{m.text}</Markdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.text}</div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-line/60 text-ink rounded-[18px] rounded-bl-md px-3.5 py-2.5 text-[13px] flex gap-1 shadow-soft">
              <span className="animate-bounce text-accent">•</span>
              <span className="animate-bounce text-accent" style={{ animationDelay: '0.2s' }}>•</span>
              <span className="animate-bounce text-accent" style={{ animationDelay: '0.4s' }}>•</span>
            </div>
          </div>
        )}
      </div>

      {/* Композер */}
      <div className="p-3 shrink-0 bg-surface border-t border-line/60 flex flex-col gap-2 z-10 relative">
        {selectedImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar px-1">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative w-12 h-12 flex-shrink-0">
                <img src={img} alt="selected" className="w-full h-full object-cover rounded-lg border border-line" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-ink border-2 border-surface text-canvas rounded-full p-0.5 hover:bg-danger transition-colors"
                  aria-label="Убрать фото"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageSelect} />
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 text-ink-faint hover:text-accent transition-colors bg-surface-2 rounded-full shrink-0 border border-line/50 hover:border-accent-ring"
            aria-label="Камера"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-ink-faint hover:text-accent transition-colors bg-surface-2 rounded-full shrink-0 border border-line/50 hover:border-accent-ring"
            aria-label="Галерея"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Задайте вопрос..."
              className="w-full bg-surface-2 border border-line/60 rounded-full pl-4 pr-11 py-2.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-ink-faint"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-br from-accent to-accent-strong text-white rounded-full hover:brightness-105 transition-all disabled:opacity-40 shadow-glow"
              aria-label="Отправить"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 ml-[-1px]" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
