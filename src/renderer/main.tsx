import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

// แท็ก platform ไว้ที่ <html> เพื่อให้ CSS เว้นที่ปุ่ม traffic-light บน macOS
document.documentElement.dataset.platform = window.api.platform

// fullscreen → เอา inset ของ traffic-light ออก (ปุ่มถูกซ่อนตอน fullscreen)
window.api.onFullscreen((fs) => {
  document.documentElement.dataset.fullscreen = String(fs)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
