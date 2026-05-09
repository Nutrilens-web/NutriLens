import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Send, Loader2, Bot, Image as ImageIcon, X } from 'lucide-react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { compressImage } from '../utils/image';
import Markdown from 'react-markdown';

export function ChatScreen() {
  const { settings, meals } = useStore();
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string, images?: string[]}[]>([
    { role: 'model', text: 'Привет! Я твой ИИ-диетолог. Чем могу помочь сегодня?' }
  ]);
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const files = Array.from(e.target.files);
    setIsLoading(true);
    
    try {
      const compressedImages = await Promise.all(
        files.map(f => compressImage(f, 1536, 1536))
      );
      
      setSelectedImages(prev => {
        const combined = [...prev, ...compressedImages];
        if (combined.length > 10) {
           return combined.slice(0, 10);
        }
        return combined;
      });
    } catch (err) {
      console.error('Failed to compress images:', err);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;
    
    if (!settings.apiKey) {
      alert('Сначала укажите API Ключ Gemini в настройках');
      return;
    }

    const newMessages = [...messages, { role: 'user' as const, text: input, images: selectedImages }];
    setMessages(newMessages);
    setInput('');
    setSelectedImages([]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: settings.apiKey });
      
      const today = new Date().toISOString().split('T')[0];
      const todayMeals = meals.filter(m => m.date === today);
      
      const systemContext = `Ты дружелюбный и профессиональный ИИ-диетолог.
Твоя цель - помогать пользователю, отвечать на вопросы о питании, давать советы.
Данные пользователя: цель ${settings.dailyGoal} ккал. Контекст: ${settings.userContext}.
Съедено сегодня: ${todayMeals.map(m => m.name + ' (' + m.calories + 'ккал)').join(', ')} / За день: ${todayMeals.reduce((acc, m) => acc + m.calories, 0)} ккал.
Старайся давать короткие, емкие и поддерживающие ответы.`;

      const history = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // We need to inject system instructions. Gemini uses model systemInstructions if available or we prepend it to the first user message.
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemContext
        }
      });

      // Restore history via manual messages (using send_message or just generating content with full history)
      const fullHistory = [
        ...newMessages.map(m => {
          const parts: any[] = [];
          if (m.images && m.images.length > 0) {
            m.images.forEach(img => {
              const base64Data = img.split(',')[1];
              const mimeType = img.substring(img.indexOf(':') + 1, img.indexOf(';'));
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType
                }
              });
            });
          }
          if (m.text) {
            parts.push({ text: m.text });
          } else if (parts.length > 0 && !m.text) {
            parts.push({ text: "Вот фото" });
          }
          return { role: m.role, parts };
        })
      ];
      
      const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: fullHistory,
         config: {
           systemInstruction: systemContext,
           safetySettings: [
             {
               category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_HARASSMENT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
           ],
         }
      });

      const reply = response.text || "Извините, не смог сформировать ответ.";
      setMessages([...newMessages, { role: 'model', text: reply }]);
      
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'model', text: 'Произошла ошибка. Проверьте API ключ или попробуйте позже.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] bg-white rounded-[24px] shadow-[0_0_20px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="flex items-center gap-3 p-4 shadow-sm shrink-0 bg-white z-10 relative">
        <div className="bg-emerald-100 p-2 rounded-full">
           <Bot className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">ИИ-Диетолог</h2>
           <p className="text-xs text-gray-400 font-medium">Ваш персональный помощник</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30" ref={scrollContainerRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[16px] px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-emerald-500 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm'}`}>
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {m.images.map((img, idx) => (
                    <img key={idx} src={img} alt="attached" className="w-16 h-16 object-cover rounded-[8px] bg-white/20" />
                  ))}
                </div>
              )}
              {m.role === 'model' ? (
                <div className="prose prose-sm max-w-none text-gray-800 prose-p:leading-snug prose-li:my-0 pb-1">
                  <Markdown>{m.text}</Markdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.text}</div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-[16px] rounded-bl-none px-4 py-2.5 text-sm flex gap-1">
               <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 shrink-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-2 z-10 relative">
         {selectedImages.length > 0 && (
           <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar px-1">
             {selectedImages.map((img, idx) => (
               <div key={idx} className="relative w-14 h-14 flex-shrink-0">
                 <img src={img} alt="selected" className="w-full h-full object-cover rounded-[10px] border border-gray-200" />
                 <button 
                    onClick={() => removeImage(idx)} 
                    className="absolute -top-1.5 -right-1.5 bg-gray-900 border-2 border-white text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                 >
                   <X className="w-3 h-3" />
                 </button>
               </div>
             ))}
           </div>
         )}
         <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
            />
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-2.5 text-gray-400 hover:text-emerald-500 transition-colors bg-gray-50 rounded-full shrink-0 border border-transparent hover:border-emerald-100"
            >
               <ImageIcon className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <input 
                 type="text" 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 placeholder="Задайте вопрос..."
                 className="w-full bg-gray-50 border border-gray-100 rounded-[24px] pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button 
                 onClick={handleSend}
                 disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
                 className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-500 shadow-sm"
              >
                 {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 ml-[-1px]" />}
              </button>
            </div>
         </div>
      </div>
    </div>
  );
}
