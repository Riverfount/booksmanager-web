import { useState } from 'react'
import { FinesList, SuspensionsList } from '../components/Penalties'
import { Card, PageHeader, Pills } from '../components/ui'

export function PenaltiesPage() {
  const [tab, setTab] = useState<'fines' | 'suspensions'>('fines')
  return (
    <>
      <PageHeader title="Multas e suspensões" subtitle="Penalidades geradas por devoluções em atraso" />
      <Card>
        <Pills value={tab} onChange={setTab} options={[{ value: 'fines', label: 'Multas' }, { value: 'suspensions', label: 'Suspensões' }]} />
        {tab === 'fines' ? <FinesList /> : <SuspensionsList />}
      </Card>
    </>
  )
}
