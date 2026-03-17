// src/store/useStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subscribeToAuthChanges, logoutUser } from '../services/auth'

// Helpers
export function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(2)}`
}

export function generateServiceId() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${timestamp}${random}`
}

export function formatDate(date) {
  if (!date) return ''
  const d = date?.toDate?.() || new Date(date)
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatTime(date) {
  if (!date) return ''
  const d = date?.toDate?.() || new Date(date)
  return d.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateTime(date) {
  if (!date) return ''
  return `${formatDate(date)} ${formatTime(date)}`
}

// Store principal de autenticación y datos
export const useStore = create((set, get) => ({
  // Estado de autenticación
  user: null,
  loading: true,
  initialized: false,

  // Datos cacheados
  restaurants: [],
  drivers: [],
  zones: [],
  services: [],
  settlements: [],
  
  // Suscripciones activas (para limpiar)
  unsubscribes: [],
  
  // Setters
  setUser: (user) => set({ user, loading: false }),
  setRestaurants: (restaurants) => set({ restaurants }),
  setDrivers: (drivers) => set({ drivers }),
  setZones: (zones) => set({ zones }),
  setServices: (services) => set({ services }),
  setSettlements: (settlements) => set({ settlements }),
  
  // Logout
  logout: async () => {
    // Limpiar suscripciones
    const { unsubscribes } = get()
    unsubscribes.forEach(unsubscribe => unsubscribe?.())
    
    await logoutUser()
    set({ 
      user: null, 
      restaurants: [], 
      drivers: [], 
      zones: [], 
      services: [],
      settlements: [],
      unsubscribes: []
    })
  },

  // Agregar suscripción
  addUnsubscribe: (unsubscribe) => {
    set((state) => ({
      unsubscribes: [...state.unsubscribes, unsubscribe]
    }))
  },

  // Inicializar autenticación
  initAuth: () => {
    if (get().initialized) return
    
    set({ initialized: true })
    
    const unsubscribe = subscribeToAuthChanges((user) => {
      set({ user, loading: false })
    })
    
    get().addUnsubscribe(unsubscribe)
  },

  // Getters con filtros
  getActiveRestaurants: () => {
    return get().restaurants.filter(r => r.active)
  },
  
  getActiveDrivers: () => {
    return get().drivers.filter(d => d.active)
  },

  getOnlineDrivers: () => {
    return get().drivers.filter(d => d.isOnline && d.active)
  },

  getActiveZones: () => {
    return get().zones.filter(z => z.active)
  },

  getServiceById: (id) => {
    return get().services.find(s => s.id === id || s.serviceId === id)
  },

  getRestaurantById: (id) => {
    return get().restaurants.find(r => r.id === id)
  },

  getDriverById: (id) => {
    return get().drivers.find(d => d.id === id)
  },

  getPendingServices: () => {
    return get().services.filter(s => s.status === 'pendiente')
  },

  getServicesByStatus: (status) => {
    return get().services.filter(s => s.status === status)
  }
}))

// Store para el estado del mapa
export const useMapStore = create((set) => ({
  center: [10.2549, -67.5984], // Maracay
  zoom: 14,
  selectedLocation: null,
  route: null,
  
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setRoute: (route) => set({ route }),
}))

// Store para notificaciones
export const useNotificationStore = create((set) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Date.now()
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }]
    }))
    return id
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  clearNotifications: () => set({ notifications: [] })
}))

// Store para el tema (oscuro/claro) con persistencia
export const useThemeStore = create(
  persist(
    (set, get) => ({
      mode: 'dark', // Modo oscuro por defecto (estilo Ridery)

      toggleTheme: () => {
        const newMode = get().mode === 'light' ? 'dark' : 'light'
        set({ mode: newMode })
      },

      setMode: (mode) => set({ mode })
    }),
    {
      name: 'on-delivery-theme',
    }
  )
)

// Store para el estado del repartidor
export const useDriverStore = create((set, get) => ({
  isOnline: false,
  currentService: null,
  activeServices: [],
  
  setIsOnline: (isOnline) => set({ isOnline }),
  setCurrentService: (service) => set({ currentService: service }),
  setActiveServices: (services) => set({ activeServices: services }),
  
  addActiveService: (service) => {
    set((state) => ({
      activeServices: [...state.activeServices, service]
    }))
  },
  
  removeActiveService: (serviceId) => {
    set((state) => ({
      activeServices: state.activeServices.filter(s => s.id !== serviceId)
    }))
  }
}))

// Store para el estado del restaurante
export const useRestaurantStore = create(
  persist(
    (set, get) => ({
      restaurantData: null, // Datos completos del restaurante desde Firestore
      selectedZone: null,
      newServiceData: null,
      
      setRestaurantData: (data) => set({ restaurantData: data }),
      setSelectedZone: (zone) => set({ selectedZone: zone }),
      setNewServiceData: (data) => set({ newServiceData: data }),
      
      resetNewService: () => set({ 
        selectedZone: null, 
        newServiceData: null 
      }),
      
      clearRestaurantData: () => set({
        restaurantData: null,
        selectedZone: null,
        newServiceData: null
      })
    }),
    {
      name: 'on-delivery-restaurant',
      partialize: (state) => ({ restaurantData: state.restaurantData })
    }
  )
)

// Store para estadísticas
export const useStatsStore = create((set) => ({
  dashboardStats: null,
  restaurantStats: null,
  driverStats: null,
  loading: false,
  
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setRestaurantStats: (stats) => set({ restaurantStats: stats }),
  setDriverStats: (stats) => set({ driverStats: stats }),
  setLoading: (loading) => set({ loading }),
  
  reset: () => set({
    dashboardStats: null,
    restaurantStats: null,
    driverStats: null,
    loading: false
  })
}))
