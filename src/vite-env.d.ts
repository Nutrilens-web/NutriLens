/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// vite-plugin-pwa 1.3.0 не поставляет готовых типов для React-шима
// (virtual:pwa-register/react). Рантайм-модуль присутствует и экспортирует
// useRegisterSW, поэтому Vite его разрешает — здесь лишь описываем форму
// для TypeScript.
declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisteredSW?: (
      swUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  };

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}

interface ImportMetaEnv {
  readonly VITE_NANOGPT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
