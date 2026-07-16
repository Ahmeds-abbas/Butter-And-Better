import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { BasketProvider } from "./context/BasketContext";
import "./index.css";

const chunkReloadKey = "butter-and-better:chunk-reload";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  const lastReload = Number(sessionStorage.getItem(chunkReloadKey));
  if (Number.isFinite(lastReload) && Date.now() - lastReload < 15_000) {
    return;
  }

  sessionStorage.setItem(chunkReloadKey, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <BasketProvider>
        <App />
      </BasketProvider>
    </BrowserRouter>
  </StrictMode>,
);
