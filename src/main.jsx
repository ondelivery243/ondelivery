// src/main.jsx
import { StrictMode, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import App from './App'
import { lightTheme, darkTheme, RIDERY_COLORS } from './theme/theme'
import { useStore, useThemeStore } from './store/useStore'
import './index.css'

// Componente para inicializar autenticación
const AuthProvider = ({ children }) => {
  const initAuth = useStore((state) => state.initAuth)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return children
}

// Componente para manejar el tema
const ThemeProviderWithMode = ({ children }) => {
  const mode = useThemeStore((state) => state.mode)

  // Actualizar el tema cuando cambie el modo
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    // Colores estilo Ridery
    document.body.style.backgroundColor = mode === 'dark' ? RIDERY_COLORS.darkBg : '#FAFAFA'
  }, [mode])

  const theme = useMemo(() => {
    return mode === 'dark' ? darkTheme : lightTheme
  }, [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProviderWithMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProviderWithMode>
    </BrowserRouter>
  </StrictMode>,
)
