// TapControl.jsx
// Container for all three tap cards.
// Uses @dnd-kit (DndContext + SortableContext + arrayMove) for drag-and-drop reordering,
// mirroring the pattern from the react-drag-and-drop-main reference project.

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'

import TapCard from './TapCard'
import TimerSetterPopup from './TimerSetterPopup'
import { useMqttContext } from '../../context/MqttContext'

// Initial tap definitions — the order of this array controls render order
const INITIAL_TAPS = [
  { id: 'front-tap', label: 'Front', timerClass: 'flip-timer-front', switchId: 'front-tap-switch' },
  { id: 'back-tap', label: 'Back', timerClass: 'flip-timer-back', switchId: 'back-tap-switch' },
  { id: 'down-tap', label: 'Down', timerClass: 'flip-timer-down', switchId: 'down-tap-switch' },
]

function TapControl() {
  // Ordered list of tap definitions — reordered on drag end
  const [taps, setTaps] = useState(INITIAL_TAPS)

  // Switch on/off state keyed by tap id
  const [switches, setSwitches] = useState({
    'front-tap': false,
    'back-tap': false,
    'down-tap': false,
  })

  // Timer setter popup state
  const [popup, setPopup] = useState({ open: false, title: '', tapId: null })
  
  // Track which tap is currently running to animate the valve image
  const [activeTapId, setActiveTapId] = useState(null)

  // Refs to each FlipTimer's imperative restart() handle
  const timerRefs = useRef({
    'front-tap': null,
    'back-tap': null,
    'down-tap': null,
  })

  const { publish, subscribe } = useMqttContext()

  // ── Listen for MQTT TAP_START messages to control the timers ──
  useEffect(() => {
    const unsub = subscribe('home/servo/command', (payload) => {
      if (payload.startsWith('TAP_START:')) {
        const tapId = payload.split(':')[1]
        setActiveTapId(tapId)
        // Pause any running timers
        Object.values(timerRefs.current).forEach(t => t?.stop())
        // Start the specific tap
        if (timerRefs.current[tapId]) {
          timerRefs.current[tapId].start()
        }
      } else if (payload === 'SEQUENCE_DONE' || payload === 'OFF') {
        setActiveTapId(null)
        Object.values(timerRefs.current).forEach(t => t?.stop())
      }
    })
    return unsub
  }, [subscribe])

  useEffect(() => {
    fetch('/api/motor-api')
      .then(res => res.json())
      .then(data => {
        setSwitches({
          'front-tap': data.front_enabled,
          'back-tap': data.back_enabled,
          'down-tap': data.down_enabled,
        })
        if (timerRefs.current['front-tap']) timerRefs.current['front-tap'].set(data.front_timer)
        if (timerRefs.current['back-tap']) timerRefs.current['back-tap'].set(data.back_timer)
        if (timerRefs.current['down-tap']) timerRefs.current['down-tap'].set(data.down_timer)
        
        if (data.taps_order) {
          try {
            const order = JSON.parse(data.taps_order)
            let currentOrder = INITIAL_TAPS
            if (Array.isArray(order) && order.length === 3) {
              const sortedTaps = []
              order.forEach(id => {
                const found = INITIAL_TAPS.find(t => t.id === id)
                if (found) sortedTaps.push(found)
              })
              if (sortedTaps.length === 3) {
                setTaps(sortedTaps)
                currentOrder = sortedTaps
              }
            }
            
            // Push the loaded config directly to MQTT so ESP32 has it before sequence starts
            const pinMap = { 'front-tap': 7, 'back-tap': 8, 'down-tap': 11 }
            const cfgParts = currentOrder.map(t => {
              let ms = 900000
              if (t.id === 'front-tap') ms = data.front_timer || 900000
              else if (t.id === 'back-tap') ms = data.back_timer || 900000
              else if (t.id === 'down-tap') ms = data.down_timer || 900000
              
              let en = 0
              if (t.id === 'front-tap') en = data.front_enabled ? 1 : 0
              else if (t.id === 'back-tap') en = data.back_enabled ? 1 : 0
              else if (t.id === 'down-tap') en = data.down_enabled ? 1 : 0
              
              return `${pinMap[t.id]}:${en}:${ms}`
            }).join(':')
            
            publish('home/servo/command', `CFG:${cfgParts}`)
          } catch(e) { console.error('Failed to parse taps order', e) }
        }
      })
      .catch(err => console.error('Failed to load tap config:', err))
  }, [publish])

  function saveTapsConfig(newSwitches, currentTaps = taps) {
    const msFront = timerRefs.current['front-tap']?.getDurationMs() || 900000;
    const msBack = timerRefs.current['back-tap']?.getDurationMs() || 900000;
    const msDown = timerRefs.current['down-tap']?.getDurationMs() || 900000;
    
    // Construct the ordered CFG string for ESP32
    // Format: CFG:pin1:en1:ms1:pin2:en2:ms2:pin3:en3:ms3
    const pinMap = { 'front-tap': 7, 'back-tap': 8, 'down-tap': 11 }
    const cfgParts = currentTaps.map(t => {
      let ms
      if (t.id === 'front-tap') ms = msFront
      else if (t.id === 'back-tap') ms = msBack
      else if (t.id === 'down-tap') ms = msDown
      const en = newSwitches[t.id] ? 1 : 0
      return `${pinMap[t.id]}:${en}:${ms}`
    }).join(':')
    
    publish('home/servo/command', `CFG:${cfgParts}`)

    fetch('/api/motor-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'taps_config',
        front_enabled: newSwitches['front-tap'],
        front_timer: msFront,
        back_enabled: newSwitches['back-tap'],
        back_timer: msBack,
        down_enabled: newSwitches['down-tap'],
        down_timer: msDown,
        taps_order: currentTaps.map(t => t.id)
      })
    }).catch(err => console.error('Failed to save tap config:', err))
  }

  // ── @dnd-kit sensors ──
  // distance: 8 means you must drag at least 8px before a drag starts,
  // so regular clicks on child elements (timer, switch) still fire normally.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Drag end: find old and new positions, arrayMove to reorder ──
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = taps.findIndex(t => t.id === active.id)
    const to = taps.findIndex(t => t.id === over.id)
    const newTaps = arrayMove(taps, from, to)
    setTaps(newTaps)
    saveTapsConfig(switches, newTaps)
  }

  function handleSwitchChange(tapId, isOn) {
    const newSwitches = { ...switches, [tapId]: isOn }
    setSwitches(newSwitches)
    console.log(`${tapId} switch:`, isOn ? 'ON' : 'OFF')
    saveTapsConfig(newSwitches)
  }

  function openTimerSetter(tapId, label) {
    setPopup({ open: true, title: `${label} Timer`, tapId })
  }

  function handleTimerSet(ms) {
    if (popup.tapId && timerRefs.current[popup.tapId]) {
      timerRefs.current[popup.tapId].set(ms)
      saveTapsConfig(switches, taps)
    }
  }

  return (
    <div id="taps-main-container">
      <h3>Tap Control</h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={taps} strategy={verticalListSortingStrategy}>
          <div id="taps-container">
            {taps.map(tap => (
              <TapCard
                key={tap.id}
                id={tap.id}
                label={tap.label}
                timerClass={tap.timerClass}
                switchId={tap.switchId}
                switchChecked={switches[tap.id]}
                isActive={activeTapId === tap.id}
                onSwitchChange={isOn => handleSwitchChange(tap.id, isOn)}
                onTimerClick={() => openTimerSetter(tap.id, tap.label)}
                timerRef={el => { timerRefs.current[tap.id] = el }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <TimerSetterPopup
        open={popup.open}
        title={popup.title}
        onClose={() => setPopup(p => ({ ...p, open: false }))}
        onSet={handleTimerSet}
      />
    </div>
  )
}

export default TapControl
