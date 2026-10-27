import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/** Reads the one-time `token` of an e-mail link and takes it out of the address bar, so it is not kept in the history. */
export function useLinkToken(): string {
  const [params, setParams] = useSearchParams()
  const [token] = useState(() => params.get('token') ?? '')
  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true })
  }, [params, setParams])
  return token
}
