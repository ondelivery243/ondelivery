// src/theme/theme.js
import { createTheme, alpha } from '@mui/material/styles'

// ============================================
// COLORES ESTILO RIDERY
// ============================================
// Verde brillante característico de Ridery
const rideryGreen = '#00C853'      // Verde principal
const rideryGreenLight = '#5EF582' // Verde claro
const rideryGreenDark = '#009624'  // Verde oscuro

// Amarillo dorado para acentos y estrellas
const rideryYellow = '#FFD600'
const rideryYellowLight = '#FFEA00'
const rideryYellowDark = '#FFAB00'

// Colores de fondo oscuros (Ridery style)
const darkBg = '#121212'
const darkPaper = '#1E1E1E'
const darkElevated = '#2C2C2C'

// ============================================
// TEMA CLARO (con colores Ridery)
// ============================================
export const lightPalette = {
  primary: {
    main: rideryGreen,
    light: rideryGreenLight,
    dark: rideryGreenDark,
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: rideryYellow,
    light: rideryYellowLight,
    dark: rideryYellowDark,
    contrastText: '#121212',
  },
  success: {
    main: '#00E676',
    light: '#69F0AE',
    dark: '#00C853',
  },
  error: {
    main: '#FF5252',
    light: '#FF8A80',
    dark: '#D32F2F',
  },
  warning: {
    main: '#FFD600',
    light: '#FFEA00',
    dark: '#FFAB00',
  },
  info: {
    main: '#40C4FF',
    light: '#80D8FF',
    dark: '#00B0FF',
  },
  background: {
    default: '#FAFAFA',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#121212',
    secondary: '#666666',
  },
  divider: '#E0E0E0',
  grey: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
}

// ============================================
// TEMA OSCURO (Estilo Ridery - Predeterminado)
// ============================================
export const darkPalette = {
  primary: {
    main: rideryGreen,
    light: rideryGreenLight,
    dark: rideryGreenDark,
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: rideryYellow,
    light: rideryYellowLight,
    dark: rideryYellowDark,
    contrastText: '#121212',
  },
  success: {
    main: '#00E676',
    light: '#69F0AE',
    dark: '#00C853',
  },
  error: {
    main: '#FF5252',
    light: '#FF8A80',
    dark: '#D32F2F',
  },
  warning: {
    main: '#FFD600',
    light: '#FFEA00',
    dark: '#FFAB00',
  },
  info: {
    main: '#40C4FF',
    light: '#80D8FF',
    dark: '#00B0FF',
  },
  background: {
    default: darkBg,
    paper: darkPaper,
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
  },
  divider: '#333333',
  grey: {
    50: '#121212',
    100: '#1E1E1E',
    200: '#2C2C2C',
    300: '#3D3D3D',
    400: '#525252',
    500: '#757575',
    600: '#9E9E9E',
    700: '#BDBDBD',
    800: '#E0E0E0',
    900: '#F5F5F5',
  },
}

// ============================================
// COMPONENTES ESTILO RIDERY
// ============================================
const baseComponents = (palette, isDark = false) => ({
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 25, // Más redondeado estilo Ridery
        padding: '12px 28px',
        boxShadow: 'none',
        fontWeight: 700,
        fontSize: '0.9rem',
        letterSpacing: '0.5px',
        '&:hover': {
          boxShadow: isDark 
            ? '0 4px 20px rgba(0, 200, 83, 0.4)'
            : `0 4px 20px ${alpha(palette.primary.main, 0.3)}`,
        },
      },
      contained: {
        background: `linear-gradient(135deg, ${palette.primary.main} 0%, ${palette.primary.dark} 100%)`,
        '&:hover': {
          background: `linear-gradient(135deg, ${palette.primary.light} 0%, ${palette.primary.main} 100%)`,
        },
      },
      containedSecondary: {
        background: palette.secondary.main,
        color: '#121212',
        '&:hover': {
          background: palette.secondary.light,
        },
      },
      outlined: {
        borderWidth: 2,
        '&:hover': {
          borderWidth: 2,
          backgroundColor: alpha(palette.primary.main, 0.08),
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        boxShadow: isDark 
          ? '0 4px 20px rgba(0, 0, 0, 0.5)'
          : `0 4px 20px ${alpha(palette.text.primary, 0.08)}`,
        borderRadius: 16,
        backgroundColor: isDark ? darkPaper : palette.background.paper,
        border: isDark ? '1px solid #333333' : 'none',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        boxShadow: isDark 
          ? '0 4px 20px rgba(0, 0, 0, 0.5)'
          : `0 4px 20px ${alpha(palette.text.primary, 0.08)}`,
        backgroundColor: isDark ? darkPaper : palette.background.paper,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          backgroundColor: isDark ? darkElevated : palette.background.default,
          '& fieldset': {
            borderColor: isDark ? '#444444' : '#E0E0E0',
          },
          '&:hover fieldset': {
            borderColor: palette.primary.main,
          },
          '&.Mui-focused fieldset': {
            borderColor: palette.primary.main,
            borderWidth: 2,
          },
        },
        '& .MuiInputLabel-root': {
          color: palette.text.secondary,
          '&.Mui-focused': {
            color: palette.primary.main,
          },
        },
        '& .MuiInputBase-input': {
          color: palette.text.primary,
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 600,
        borderRadius: 16,
      },
      colorPrimary: {
        backgroundColor: alpha(palette.primary.main, 0.2),
        color: palette.primary.main,
      },
      colorSuccess: {
        backgroundColor: alpha(palette.success.main, 0.2),
        color: palette.success.main,
      },
      colorWarning: {
        backgroundColor: alpha(palette.warning.main, 0.2),
        color: palette.warning.dark,
      },
      colorError: {
        backgroundColor: alpha(palette.error.main, 0.2),
        color: palette.error.main,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRadius: 0,
        backgroundColor: isDark ? darkBg : palette.background.default,
        borderRight: isDark ? '1px solid #333333' : 'none',
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: 'none',
        backgroundColor: isDark ? darkBg : palette.background.paper,
        borderBottom: isDark ? '1px solid #333333' : '1px solid #E0E0E0',
      },
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: {
        backgroundColor: isDark ? darkBg : palette.background.paper,
        borderTop: isDark ? '1px solid #333333' : '1px solid #E0E0E0',
      },
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: {
        color: palette.text.secondary,
        '&.Mui-selected': {
          color: palette.primary.main,
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: palette.divider,
        color: palette.text.primary,
      },
      head: {
        fontWeight: 700,
        color: palette.primary.main,
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:hover': {
          backgroundColor: alpha(palette.primary.main, 0.08),
        },
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: {
        backgroundColor: palette.primary.main,
        color: '#FFFFFF',
      },
    },
  },
  MuiFab: {
    styleOverrides: {
      root: {
        background: `linear-gradient(135deg, ${palette.primary.main} 0%, ${palette.primary.dark} 100%)`,
        boxShadow: '0 6px 20px rgba(0, 200, 83, 0.4)',
        '&:hover': {
          background: `linear-gradient(135deg, ${palette.primary.light} 0%, ${palette.primary.main} 100%)`,
          boxShadow: '0 8px 25px rgba(0, 200, 83, 0.5)',
        },
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        backgroundColor: isDark ? darkElevated : '#E0E0E0',
      },
      bar: {
        background: `linear-gradient(90deg, ${palette.primary.main} 0%, ${palette.primary.light} 100%)`,
      },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: {
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: palette.primary.main,
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: palette.primary.main,
        },
      },
    },
  },
  MuiCheckbox: {
    styleOverrides: {
      root: {
        '&.Mui-checked': {
          color: palette.primary.main,
        },
      },
    },
  },
  MuiRadio: {
    styleOverrides: {
      root: {
        '&.Mui-checked': {
          color: palette.primary.main,
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
        backgroundColor: isDark ? darkPaper : palette.background.paper,
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: 20,
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontWeight: 700,
        color: palette.text.primary,
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: isDark ? darkElevated : '#424242',
        color: '#FFFFFF',
        borderRadius: 8,
      },
    },
  },
  MuiSnackbar: {
    styleOverrides: {
      root: {
        '& .MuiSnackbarContent-root': {
          borderRadius: 12,
          backgroundColor: isDark ? darkElevated : '#424242',
        },
      },
    },
  },
})

// ============================================
// CREAR TEMAS
// ============================================
export const lightTheme = createTheme({
  palette: lightPalette,
  typography: {
    fontFamily: [
      'Poppins',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h3: { fontWeight: 700, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { 
      textTransform: 'none', 
      fontWeight: 700,
      letterSpacing: '0.5px',
    },
  },
  shape: { borderRadius: 12 },
  components: baseComponents(lightPalette, false),
})

export const darkTheme = createTheme({
  palette: {
    ...darkPalette,
    mode: 'dark',
  },
  typography: {
    fontFamily: [
      'Poppins',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h3: { fontWeight: 700, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { 
      textTransform: 'none', 
      fontWeight: 700,
      letterSpacing: '0.5px',
    },
  },
  shape: { borderRadius: 12 },
  components: baseComponents(darkPalette, true),
})

// Default export - Tema oscuro como predeterminado (estilo Ridery)
export default darkTheme

// ============================================
// CONSTANTES DE COLORES PARA USO DIRECTO
// ============================================
export const RIDERY_COLORS = {
  // Colores principales
  primary: rideryGreen,
  primaryLight: rideryGreenLight,
  primaryDark: rideryGreenDark,
  
  // Colores secundarios
  secondary: rideryYellow,
  secondaryLight: rideryYellowLight,
  secondaryDark: rideryYellowDark,
  
  // Fondos oscuros
  darkBg: darkBg,
  darkPaper: darkPaper,
  darkElevated: darkElevated,
  
  // Gradientes
  gradientPrimary: `linear-gradient(135deg, ${rideryGreen} 0%, ${rideryGreenDark} 100%)`,
  gradientSecondary: `linear-gradient(135deg, ${rideryYellow} 0%, ${rideryYellowDark} 100%)`,
  gradientHero: `linear-gradient(135deg, ${rideryGreen} 0%, #00B0FF 100%)`,
  
  // Sombras con color
  shadowGreen: '0 4px 20px rgba(0, 200, 83, 0.4)',
  shadowYellow: '0 4px 20px rgba(255, 214, 0, 0.4)',
}
