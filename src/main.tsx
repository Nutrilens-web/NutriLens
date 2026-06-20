import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { StoreProvider } from "./store/useStore.tsx";
import { PWAUpdate } from "./components/PWAUpdate.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
      {/* Следит за новой версией service worker'а и предлагает обновиться
          тостом — пользователь видит кнопку «Обновить», а не сидит слепо
          на старой оболочке до ручного сброса кэша. */}
      <PWAUpdate />
    </StoreProvider>
  </StrictMode>,
);
