import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Send, Loader2, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

export function ChatScreen() {
  const { settings, meals } = useStore();
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Привет! Я твой ИИ-диетолог. Чем могу помочь сегодня?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!settings.apiKey) {
      alert('Сначала укажите API Ключ Gemini в настройках');
      return;
    }

    const newMessages = [...messages, { role: 'user' as const, text: input }];
    setMessages(newMessages);
    setInput('');
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
        ...newMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      ];
      
      const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: fullHistory,
         config: {
           systemInstruction: systemContext
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
    <div className="flex flex-col h-[calc(100vh-80px)] pb-6 bg-white rounded-t-[30px]">
      <div className="flex items-center gap-3 p-5 shadow-sm border-b border-gray-50 shrink-0">
        <div className="bg-emerald-100 p-2 rounded-full">
           <Bot className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">ИИ-Диетолог</h2>
           <p className="text-xs text-gray-400 font-medium">Ваш персональный помощник</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[16px] px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-emerald-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
              {m.text}
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
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 shrink-0 bg-white">
         <div className="relative flex items-center">
            <input 
               type="text" 
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSend()}
               placeholder="Задайте вопрос о питании..."
               className="w-full bg-gray-50 border border-gray-200 rounded-[20px] pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button 
               onClick={handleSend}
               disabled={isLoading || !input.trim()}
               className="absolute right-2 p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-500"
            >
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
         </div>
      </div>
    </div>
  );
}
