'use client'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'

export type User = {
  clientName: string
  email?: string
  role?: string
  // add more fields as per your backend response
}

interface DecodedToken {
  id: string
  username: string
  role: string
  organisation_id: any
  organisation_ids: any[]
  user_type: string
  permissions: any
  exp: number
  iat: number
}


export const setAuthSession = (user: any, token?: string) => {
  if (typeof window !== 'undefined') {
    // Store user info
    localStorage.setItem('auth_user', JSON.stringify(user))
    
    // Store token in localStorage for API calls
    if (token) {
      console.log('🟢 Storing auth token:', token.substring(0, 20) + '...')
      localStorage.setItem('token', token)
      Cookies.set('auth_token', token, { expires: 1 })
      Cookies.set('user_info', JSON.stringify(user), { expires: 1 })
      console.log('🟢 Auth session stored successfully')
    } else {
      console.warn('⚠️ No token provided to setAuthSession')
    }
  }
}

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false

  const token = Cookies.get('auth_token')
  if (!token || token === 'undefined' || token === 'null') return false

  try {
    const decoded: DecodedToken = jwtDecode(token)
    const now = Date.now()

    // Token expiration check
    if (decoded.exp * 1000 < now) {
      clearAuthSession() // Clear invalid session
      return false
    }

    return true
  } catch (err) {
    console.error('Invalid JWT token:', err)
    clearAuthSession()
    return false
  }
}


export const getUserFromCookies = (): DecodedToken | null => {
  // First try to get full user data from user_info cookie (includes permissions)
  const userInfo = Cookies.get('user_info')
  if (userInfo) {
    try {
      const userData = JSON.parse(userInfo)
      // Verify token is still valid
      const token = Cookies.get('auth_token')
      if (token) {
        const decoded: DecodedToken = jwtDecode(token)
        const now = Date.now()
        if (decoded.exp * 1000 > now) {
          // Merge token data with user data for complete info
          // JWT decoded data takes precedence (has latest permissions)
          return {
            ...userData,
            ...decoded,
            // Use JWT permissions (most authoritative), fallback to userData, then empty object
            permissions: decoded.permissions || userData.permissions || {}
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse user info:', error)
    }
  }

  // Fallback to token-only data (legacy)
  const token = Cookies.get('auth_token')
  if (!token) return null

  try {
    const decoded: DecodedToken = jwtDecode(token)
    const now = Date.now()
    if (decoded.exp * 1000 < now) return null
    return decoded
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}


export const clearAuthSession = () => {
  if (typeof window !== 'undefined') {
    // Clear all cookies
    Cookies.remove('auth_token')
    Cookies.remove('user_info')

    // Clear all localStorage (removes auth data and user preferences)
    localStorage.clear()

    // Clear all sessionStorage
    sessionStorage.clear()

    console.log('🧹 All cookies, localStorage, and sessionStorage cleared')
  }
}

