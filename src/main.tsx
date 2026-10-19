import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Chỉ nạp các subset cần thiết (có tiếng Việt).
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-ext-400-italic.css'
import '@fontsource/cormorant-garamond/vietnamese-400-italic.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/latin-ext-500-italic.css'
import '@fontsource/cormorant-garamond/vietnamese-500-italic.css'
import '@fontsource/be-vietnam-pro/latin-300.css'
import '@fontsource/be-vietnam-pro/latin-ext-300.css'
import '@fontsource/be-vietnam-pro/vietnamese-300.css'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-ext-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'

import './app/styles.css'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
