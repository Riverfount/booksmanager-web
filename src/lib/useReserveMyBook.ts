import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '../api/client'

/** Reserves a book for the logged-in reader; the API enforces the rules and answers all the reasons at once. */
export function useReserveMyBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookId: number) => call(api.POST('/api/v1/me/reservations', { body: { bookId } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
