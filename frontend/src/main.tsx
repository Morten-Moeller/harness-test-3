import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { loadConfig } from './app/config'
import './styles/tokens.css'
import './styles/global.css'

async function start(): Promise<void> {
  const config = await loadConfig()
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('element #root is missing')
  }
  createRoot(root).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  )
}

void start()
