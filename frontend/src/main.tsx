import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try { document.documentElement.classList.toggle('reduce-motion', localStorage.getItem('syj-reduce-motion') === 'true') } catch { /* Browser storage may be disabled; OS motion preference still applies. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
