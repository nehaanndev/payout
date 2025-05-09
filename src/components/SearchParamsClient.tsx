'use client'
import { useSearchParams, ReadonlyURLSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function SearchParamsClient({
      onParams,
    }: {
      onParams: (params: ReadonlyURLSearchParams) => void
    }) {
      const params = useSearchParams()
    
      // 🚀 defer the callback until *after* render
      useEffect(() => {
        onParams(params)
      }, [params, onParams])
    
      return null
    }
  