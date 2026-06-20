import { MODELS } from "./models";

export async function callNanoGPTFallback(params: any): Promise<{text: string}> {
  const messages = [];

  if (params.config?.systemInstruction) {
     let sysContent = params.config.systemInstruction;
     if (typeof sysContent === 'object' && Array.isArray(sysContent.parts)) {
         sysContent = sysContent.parts.map((p: any) => p.text).join("");
     } else if (typeof sysContent === 'object' && typeof sysContent.text === 'string') {
         sysContent = sysContent.text;
     } else if (typeof sysContent !== 'string') {
         sysContent = String(sysContent);
     }
     
     messages.push({
         role: "system",
         content: sysContent
     });
  }

  for (const content of params.contents) {
     let textContent = "";
     const imageContents = [];
     for (const part of content.parts) {
         if (part.text) {
             textContent += part.text;
         }
         if (part.inlineData) {
             imageContents.push({
                 type: "image_url",
                 image_url: {
                     url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                 }
             });
         }
     }
     
     if (imageContents.length > 0) {
         messages.push({
             role: content.role === 'model' ? 'assistant' : 'user',
             content: [
                 { type: "text", text: textContent },
                 ...imageContents
             ]
         });
     } else {
         messages.push({
             role: content.role === 'model' ? 'assistant' : 'user',
             content: textContent
         });
     }
  }

  if (params.config?.responseMimeType === "application/json") {
      const lastMsg = messages[messages.length - 1];
      const jsonReq = `\n\nIMPORTANT: Return ONLY valid JSON without any markdown formatting wrappers like \`\`\`json. ${params.config?.responseSchema ? 'Schema requirements: ' + JSON.stringify(params.config.responseSchema) : ''}`;
      if (typeof lastMsg.content === 'string') {
          lastMsg.content += jsonReq;
      } else if (Array.isArray(lastMsg.content)) {
          lastMsg.content[0].text += jsonReq;
      }
  }

  // Ключ NanoGPT пользователь указывает сам в Настройках приложения
  // (settings.nanoApiKey). Раньше ключ был захардкожен в коде через atob(...)
  // и попадал в клиентский бандл — это утечка секрета. Опционально ключ можно
  // задать через VITE_NANOGPT_API_KEY (тогда он не требуется в Настройках).
  const NANO_API_KEY = (params.nanoApiKey as string | undefined) ||
    (import.meta.env.VITE_NANOGPT_API_KEY as string | undefined);

  if (!NANO_API_KEY) {
    throw new Error(
      "Не указан ключ NanoGPT. Добавьте его в Настройках приложения (раздел «Ключ NanoGPT») при использовании режимов «Простой»/«Продвинутый», либо используйте бесплатный режим со своим ключом Gemini.",
    );
  }

  const response = await fetch("https://nano-gpt.com/api/v1/chat/completions", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NANO_API_KEY}`
      },
      body: JSON.stringify({
          // params.model — конкретная модель вызова (важно для advanced-каскада:
          // lite на первом проходе, мощная на эскалации). nanoModel — лишь фолбэк,
          // если модель почему-то не передали.
          model: params.model || params.nanoModel || MODELS.advanced,
          messages: messages
      })
  });

  if (!response.ok) {
     throw new Error(`NanoGPT fallback failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content;

  if (params.config?.responseMimeType === "application/json") {
     text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  return { text };
}

