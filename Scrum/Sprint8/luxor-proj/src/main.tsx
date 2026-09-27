import "./styles/globals.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from "./app/App";

console.log("Luxor Frontend Starting...");

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error("Root element not found!");
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
