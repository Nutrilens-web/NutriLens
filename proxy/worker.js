/**
 * NutriLens — прокси-воркер для обхода региональных блокировок API.
 *
 * Поддерживает два вышестоящих API, отличающихся по префиксу пути:
 *
 *   /gemini/*   -> https://generativelanguage.googleapis.com/*
 *                 (используется @google/genai SDK через httpOptions.baseUrl)
 *
 *   /nano/*     -> https://nano-gpt.com/*
 *                 (используется fallback.ts как nanoApiEndpoint)
 *
 * В Настройках приложения поля заполняются так:
 *   URL прокси для Gemini: https://<worker>.workers.dev/gemini
 *   URL прокси для NanoGPT: https://<worker>.workers.dev/nano
 *
 * Безопасность: воркер НЕ хранит и НЕ логирует ключи — они передаются
 * клиентом в заголовках Authorization / x-goog-api-key и прозрачно
 * прокидываются вверх. При желании можно ограничить доступ переменной
 * окружения PROXY_TOKEN (см. ниже проверку X-Proxy-Token).
 */

const UPSTREAM = {
  gemini: "https://generativelanguage.googleapis.com",
  nano: "https://nano-gpt.com",
};

// Заголовки, которые нельзя прокидывать «как есть» между хопами.
const HOP_BY_HOP = new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-proto",
  "x-real-ip",
]);

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ----- (Опционально) защита общим токеном ----------------------------
    // Задайте переменную окружения PROXY_TOKEN в настройках воркера, чтобы
    // чужие не могли пользоваться вашим прокси. Если переменная не задана —
    // проверка отключена (воркер публичный).
    if (env.PROXY_TOKEN) {
      const token = request.headers.get("x-proxy-token");
      if (token !== env.PROXY_TOKEN) {
        return jsonError("Unauthorized", 401);
      }
    }

    // Разбор /<prefix>/<остальной путь>
    const segments = url.pathname.split("/").filter(Boolean); // ["gemini", "v1beta", ...]
    if (segments.length === 0) {
      return jsonError("Missing API prefix. Use /gemini/* or /nano/*");
    }

    const prefix = segments[0];
    const upstreamBase = UPSTREAM[prefix];
    if (!upstreamBase) {
      return jsonError(`Unknown prefix '${prefix}'. Use /gemini/* or /nano/*`, 404);
    }

    // Собираем целевой URL: вышестоящий хост + исходный путь БЕЗ префикса.
    const targetPath = "/" + segments.slice(1).join("/");
    const targetUrl = upstreamBase + targetPath + url.search;

    // Переносим заголовки запроса, выкидывая служебные CF/hop-by-hop.
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    // CORS: разрешаем запросы из браузера приложения.
    headers.set("origin", upstreamBase);
    headers.set("referer", upstreamBase + "/");

    // Предзапросы CORS от браузера.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "follow",
      });
    } catch (err) {
      return jsonError(`Upstream fetch failed: ${String(err)}`, 502);
    }

    // Возвращаем ответ, добавляя CORS-заголовки.
    const respHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders())) {
      respHeaders.set(k, v);
    }
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: respHeaders,
    });
  },
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, Authorization, x-goog-api-key, X-Proxy-Token, User-Agent",
    "access-control-max-age": "86400",
  };
}
