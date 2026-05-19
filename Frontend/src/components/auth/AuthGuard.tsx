'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const check = () => {
      const valid = isAuthenticated()
      if (!valid) {
        router.replace('/login')
      } else {
        setChecked(true)
      }
    }

    check()
  }, [router])

  if (!checked) return null

  return <>{children}</>
}

