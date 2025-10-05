// ...existing code...
import React, { useEffect, useState } from 'react'

export default function CpuSchedulingVisualizer() {
  const [processes, setProcesses] = useState([
    { id: 'P1', arrival: 0, burst: 5, priority: 2 },
    { id: 'P2', arrival: 1, burst: 3, priority: 1 },
    { id: 'P3', arrival: 2, burst: 8, priority: 3 }
  ])

  const [algo, setAlgo] = useState('FCFS') // 'FCFS' | 'RoundRobin' | 'Priority'
  const [quantum, setQuantum] = useState(2)
  const [newProc, setNewProc] = useState({ id: '', arrival: '', burst: '', priority: '' })

  const [segments, setSegments] = useState([]) // {id,start,end}
  const [metrics, setMetrics] = useState({}) // id -> {arrival,burst,completion,turnaround,waiting}
  const [avgTurnaround, setAvgTurnaround] = useState(0)
  const [avgWaiting, setAvgWaiting] = useState(0)

  const copy = (x) => JSON.parse(JSON.stringify(x))

  function computeAverages(metricsObj) {
    const ids = Object.keys(metricsObj)
    if (!ids.length) return { avgT: 0, avgW: 0 }
    let totalT = 0, totalW = 0
    ids.forEach(id => {
      const m = metricsObj[id]
      m.turnaround = m.completion - m.arrival
      m.waiting = m.turnaround - m.burst
      totalT += m.turnaround
      totalW += m.waiting
    })
    return { avgT: +(totalT / ids.length).toFixed(2), avgW: +(totalW / ids.length).toFixed(2) }
  }

  function fcfsScheduler(procs) {
    const list = copy(procs).sort((a, b) => a.arrival - b.arrival)
    const segs = []
    const mets = {}
    let time = list.length ? Math.min(...list.map(p => p.arrival)) : 0
    list.forEach(p => {
      const start = Math.max(time, p.arrival)
      const end = start + Number(p.burst)
      segs.push({ id: p.id, start, end })
      mets[p.id] = { arrival: Number(p.arrival), burst: Number(p.burst), completion: end }
      time = end
    })
    const avgs = computeAverages(mets)
    return { segs, mets, ...avgs }
  }

  function priorityScheduler(procs) {
    const list = copy(procs).sort((a, b) => a.arrival - b.arrival)
    const segs = []
    const mets = {}
    let time = list.length ? Math.min(...list.map(p => p.arrival)) : 0
    const remaining = [...list]
    while (remaining.length) {
      const arrived = remaining.filter(p => p.arrival <= time)
      let next
      if (arrived.length) {
        // lower priority value = higher priority
        arrived.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival)
        next = arrived[0]
      } else {
        // jump forward
        time = remaining[0].arrival
        continue
      }
      const idx = remaining.indexOf(next)
      remaining.splice(idx, 1)
      const start = Math.max(time, next.arrival)
      const end = start + Number(next.burst)
      segs.push({ id: next.id, start, end })
      mets[next.id] = { arrival: Number(next.arrival), burst: Number(next.burst), completion: end }
      time = end
    }
    const avgs = computeAverages(mets)
    return { segs, mets, ...avgs }
  }

  function roundRobinScheduler(procs, q) {
    const list = copy(procs).sort((a, b) => a.arrival - b.arrival)
    const segs = []
    const mets = {}
    const rem = {}
    list.forEach(p => rem[p.id] = Number(p.burst))
    list.forEach(p => mets[p.id] = { arrival: Number(p.arrival), burst: Number(p.burst) })

    if (!list.length) return { segs, mets: {}, avgT: 0, avgW: 0 }

    let time = Math.min(...list.map(p => p.arrival))
    const queue = []
    let i = 0

    while (Object.keys(rem).length) {
      while (i < list.length && list[i].arrival <= time) {
        queue.push(list[i])
        i++
      }

      if (!queue.length) {
        if (i < list.length) {
          time = list[i].arrival
          continue
        } else {
          break
        }
      }

      const p = queue.shift()
      const exec = Math.min(q, rem[p.id])
      const start = time
      const end = time + exec
      segs.push({ id: p.id, start, end })
      rem[p.id] -= exec
      time = end

      while (i < list.length && list[i].arrival <= time) {
        queue.push(list[i])
        i++
      }

      if (rem[p.id] > 0) queue.push(p)
      else {
        mets[p.id].completion = time
        delete rem[p.id]
      }
    }

    const avgs = computeAverages(mets)
    return { segs, mets, ...avgs }
  }

  function runScheduler() {
    let result
    if (algo === 'FCFS') result = fcfsScheduler(processes)
    else if (algo === 'Priority') result = priorityScheduler(processes)
    else result = roundRobinScheduler(processes, Number(quantum) || 1)

    setSegments(result.segs || [])
    setMetrics(result.mets || result.metrics || {})
    setAvgTurnaround(result.avgT ?? result.avgTurnaround ?? 0)
    setAvgWaiting(result.avgW ?? result.avgWaiting ?? 0)
  }

  useEffect(() => { runScheduler() }, [processes, algo, quantum])

  // UI handlers
  const handleAddProcess = () => {
    if (newProc.burst === '' || newProc.burst === null) return
    const id = newProc.id && newProc.id.trim() !== '' ? newProc.id.trim() : `P${processes.length + 1}`
    const proc = {
      id,
      arrival: newProc.arrival === '' ? 0 : Number(newProc.arrival),
      burst: Number(newProc.burst),
      priority: newProc.priority === '' ? 0 : Number(newProc.priority)
    }
    setProcesses(prev => [...prev, proc])
    setNewProc({ id: '', arrival: '', burst: '', priority: '' })
  }

  const handleRemove = (id) => setProcesses(prev => prev.filter(p => p.id !== id))
  const handleResetExample = () => setProcesses([
    { id: 'P1', arrival: 0, burst: 5, priority: 2 },
    { id: 'P2', arrival: 1, burst: 3, priority: 1 },
    { id: 'P3', arrival: 2, burst: 8, priority: 3 }
  ])

  // render helpers
  const totalLength = segments.length ? Math.max(...segments.map(s => s.end)) : 1

  return (
    <div className="container">
      <h1>CPU Scheduling Visualizer</h1>

      <section>
        <h2>Processes</h2>

        <table className="process-table">
          <thead>
            <tr>
              <th>ID</th><th>Arrival</th><th>Burst</th><th>Priority</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processes.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.arrival}</td>
                <td>{p.burst}</td>
                <td>{p.priority}</td>
                <td>
                  <button onClick={() => handleRemove(p.id)}>Remove</button>
                </td>
              </tr>
            ))}

            <tr>
              <td>
                <input placeholder="ID (optional)" value={newProc.id} onChange={e => setNewProc({ ...newProc, id: e.target.value })} />
              </td>
              <td>
                <input type="number" placeholder="Arrival" value={newProc.arrival} onChange={e => setNewProc({ ...newProc, arrival: e.target.value })} />
              </td>
              <td>
                <input type="number" placeholder="Burst" value={newProc.burst} onChange={e => setNewProc({ ...newProc, burst: e.target.value })} />
              </td>
              <td>
                <input type="number" placeholder="Priority" value={newProc.priority} onChange={e => setNewProc({ ...newProc, priority: e.target.value })} />
              </td>
              <td>
                <button className="primary" onClick={handleAddProcess}>Add</button>
                <button onClick={handleResetExample} style={{ marginLeft: 8 }}>Reset Example</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Algorithm & Options</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <select value={algo} onChange={e => setAlgo(e.target.value)}>
            <option value="FCFS">FCFS (First Come First Served)</option>
            <option value="RoundRobin">Round Robin</option>
            <option value="Priority">Priority (non-preemptive)</option>
          </select>

          {algo === 'RoundRobin' && (
            <div>
              <label style={{ marginRight: 6 }}>Quantum</label>
              <input type="number" min="1" value={quantum} onChange={e => setQuantum(e.target.value)} style={{ width: 72 }} />
            </div>
          )}

          <button onClick={runScheduler} style={{ marginLeft: 'auto' }}>Run</button>
        </div>
      </section>

      <section>
        <h2>Metrics</h2>
        <div className="metrics">
          <div>Average Turnaround: {avgTurnaround}</div>
          <div>Average Waiting: {avgWaiting}</div>
        </div>

        <table>
          <thead>
            <tr><th>ID</th><th>Arrival</th><th>Burst</th><th>Completion</th><th>Turnaround</th><th>Waiting</th></tr>
          </thead>
          <tbody>
            {Object.keys(metrics).length ? Object.keys(metrics).map(id => {
              const m = metrics[id]
              return (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{m.arrival}</td>
                  <td>{m.burst}</td>
                  <td>{m.completion ?? '-'}</td>
                  <td>{m.turnaround ?? '-'}</td>
                  <td>{m.waiting ?? '-'}</td>
                </tr>
              )
            }) : (
              <tr><td colSpan={6} className="small">No metrics yet</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Gantt Chart</h2>
        <div className="gantt" aria-hidden>
          {segments.map((s, idx) => {
            const width = ((s.end - s.start) / totalLength) * 100
            return (
              <div
                key={idx}
                className="segment"
                title={`${s.id} (${s.start}-${s.end})`}
                style={{ width: `${width}%` }}
              >
                <span>{s.id} ({s.start}-{s.end})</span>
              </div>
            )
          })}
          {!segments.length && <div className="small">No schedule to show</div>}
        </div>
      </section>
    </div>
  )
}
// ...existing code...