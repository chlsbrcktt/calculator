import TrajectoriesSection from './Trajectories'
import './LinearAlgebra.css'

const SUBTABS = [{ id: 'trajectories', label: 'Orbital Trajectories' }]

export default function Physics() {
  return (
    <div className="la-root">
      <div className="la-subtabs">
        {SUBTABS.map(t => (
          <button key={t.id} className="la-subtab active">{t.label}</button>
        ))}
      </div>
      <div className="la-content">
        <TrajectoriesSection />
      </div>
    </div>
  )
}
