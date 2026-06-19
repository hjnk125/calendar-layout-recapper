import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Vite + React 앱이라 /next가 아니라 /react 서브패스를 쓴다.
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
