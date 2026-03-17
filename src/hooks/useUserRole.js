// src/hooks/useUserRole.js
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { ROLES } from '../services/auth'

export const useUserRole = () => {
  const { user } = useStore()
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      setRole(user.role || null)
    } else {
      setRole(null)
    }
    setLoading(false)
  }, [user])

  const isAdmin = role === ROLES.ADMIN
  const isRestaurante = role === ROLES.RESTAURANTE
  const isRepartidor = role === ROLES.REPARTIDOR

  return {
    role,
    loading,
    isAdmin,
    isRestaurante,
    isRepartidor,
    canAccess: (requiredRole) => role === requiredRole
  }
}

export default useUserRole
