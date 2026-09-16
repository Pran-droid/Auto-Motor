// TapControl.jsx — VERSION 2 (ESP32 as DB)
// Loads config from CFG_SYNC (passed as prop from App via MotorControl).
// Saves by publishing CFG: directly to MQTT — no Postgres.

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
import { publishFullConfig } from '../../utils/configBuilder'
// Initial tap definitions — the order of this array controls render order
const INITIAL_TAPS = [
  { id: 'front-tap', label: 'Front', timerClass: 'flip-timer-front', switchId: 'front-tap-switch' },
  { id: 'back-tap', label: 'Back', timerClass: 'flip-timer-back', switchId: 'back-tap-switch' },
  { id: 'down-tap', label: 'Down', timerClass: 'flip-timer-down', switchId: 'down-tap-switch' },
]

function TapControl({ initialConfig, onChange, editDefaultsMode, setEditDefaultsMode }) {
  // Ordered list of tap definitions — reordered on drag end
  const [taps, setTaps] = useState(INITIAL_TAPS)

  // Default ON/OFF state keyed by tap id
  const [defaults, setDefaults] = useState({
    'front-tap': false,
    'back-tap': false,
    'down-tap': true,
  })

  // Switch on/off state keyed by tap id
  const [switches, setSwitches] = useState({
    'front-tap': false,
    'back-tap': false,
    'down-tap': false,
  })

  // Source of truth for timers
  const [timers, setTimers] = useState({
    'front-tap': 900000,
    'back-tap': 900000,
    'down-tap': 900000,
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

  // ── Listen for MQTT messages to control the timers ──
  useEffect(() => {
    const unsubCmd = subscribe('home/servo/command', (payload) => {

      if (payload.startsWith('TAP_START:')) {
        const tapId = payload.split(':')[1]

        // 1. Stop ALL timers first
        Object.values(timerRefs.current).forEach(t => t?.stop())

        // 2. Update active tap state
        setActiveTapId(tapId)

        // 3. Start the correct timer
        const timerHandle = timerRefs.current[tapId]
        if (timerHandle) {
          timerHandle.start()
        }

      } else if (payload.startsWith('TAP_SYNC:')) {
        // ESP32 sends TAP_SYNC:tapId:remainingMs every 5 seconds during pouring.
        const parts = payload.split(':')
        const tapId = parts[1]
        const remainingMs = parseInt(parts[2], 10)

        setActiveTapId(tapId)

        Object.keys(timerRefs.current).forEach(id => {
          if (id !== tapId) timerRefs.current[id]?.stop()
        })

        const timerHandle = timerRefs.current[tapId]
        if (timerHandle) {
          timerHandle.set(remainingMs)
          timerHandle.start()
        }

      } else if (payload === 'Sequence Complete' || payload === 'OFF') {
        setActiveTapId(null)
        Object.values(timerRefs.current).forEach(t => t?.stop())
      }
    })

    const unsubStatus = subscribe('home/servo/status', (payload) => {
      if (payload.startsWith('Aborted:')) {
        setActiveTapId(null)
        Object.values(timerRefs.current).forEach(t => t?.stop())
      }
    })

    return () => {
      unsubCmd()
      unsubStatus()
    }
  }, [subscribe])

  // ── V2: Populate UI when ESP32 sends CFG_SYNC (passed as prop) ──
  useEffect(() => {
    if (!initialConfig) return
    const { front_enabled, front_timer, back_enabled, back_timer, down_enabled, down_timer, taps_order } = initialConfig

    setSwitches({
      'front-tap': front_enabled ?? false,
      'back-tap':  back_enabled  ?? false,
      'down-tap':  down_enabled  ?? false,
    })
    
    setDefaults({
      'front-tap': initialConfig.front_def ?? false,
      'back-tap':  initialConfig.back_def  ?? false,
      'down-tap':  initialConfig.down_def  ?? true,
    })
    
    setTimers({
      'front-tap': front_timer ?? 900000,
      'back-tap':  back_timer  ?? 900000,
      'down-tap':  down_timer  ?? 900000,
    })

    if (timerRefs.current['front-tap']) timerRefs.current['front-tap'].set(front_timer ?? 900000)
    if (timerRefs.current['back-tap'])  timerRefs.current['back-tap'].set(back_timer   ?? 900000)
    if (timerRefs.current['down-tap'])  timerRefs.current['down-tap'].set(down_timer   ?? 900000)

    if (taps_order) {
      try {
        const order = typeof taps_order === 'string' ? JSON.parse(taps_order) : taps_order
        if (Array.isArray(order) && order.length === 3) {
          const sorted = order.map(id => INITIAL_TAPS.find(t => t.id === id)).filter(Boolean)
          if (sorted.length === 3) setTaps(sorted)
        }
      } catch (e) { console.error('Failed to parse taps_order', e) }
    }
  }, [initialConfig])

  // ── V2: Save config by notifying App to mark dirty ──
  function saveTapsConfig(newSwitches, currentTaps = taps, currentTimers = timers, currentDefaults = defaults) {
    if (onChange) {
      onChange({
        front_enabled: newSwitches['front-tap'],
        front_timer:   currentTimers['front-tap'],
        front_def:     currentDefaults['front-tap'],
        back_enabled:  newSwitches['back-tap'],
        back_timer:    currentTimers['back-tap'],
        back_def:      currentDefaults['back-tap'],
        down_enabled:  newSwitches['down-tap'],
        down_timer:    currentTimers['down-tap'],
        down_def:      currentDefaults['down-tap'],
        taps_order:    JSON.stringify(currentTaps.map(t => t.id)),
      })
    }
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
    saveTapsConfig(switches, newTaps, timers)
  }

  function handleSwitchChange(tapId, isOn) {
    const newSwitches = { ...switches, [tapId]: isOn }
    setSwitches(newSwitches)
    saveTapsConfig(newSwitches, taps, timers, defaults)
  }

  function handleImageClick(tapId) {
    if (!editDefaultsMode) return
    const newDefaults = { ...defaults, [tapId]: !defaults[tapId] }
    setDefaults(newDefaults)
    saveTapsConfig(switches, taps, timers, newDefaults)
  }

  function openTimerSetter(tapId, label) {
    setPopup({ open: true, title: `${label} Timer`, tapId, currentMs: timers[tapId] })
  }

  function handleTimerSet(ms) {
    if (popup.tapId) {
      const newTimers = { ...timers, [popup.tapId]: ms }
      setTimers(newTimers)
      if (timerRefs.current[popup.tapId]) {
        timerRefs.current[popup.tapId].set(ms)
      }
      saveTapsConfig(switches, taps, newTimers)
    }
  }

  return (
    <div id="taps-main-container">
      <h3 
        onClick={() => setEditDefaultsMode(prev => !prev)} 
        style={{ cursor: 'pointer', transition: 'color 0.3s' }}
        className={editDefaultsMode ? 'glow-green-text' : ''}
      >
        Tap Control 
      </h3>
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
                defaultMs={timers[tap.id]}
                editDefaultsMode={editDefaultsMode}
                defaultIsOn={defaults[tap.id]}
                onImageClick={() => handleImageClick(tap.id)}
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
        currentMs={popup.currentMs}
        onClose={() => setPopup(p => ({ ...p, open: false }))}
        onSet={handleTimerSet}
      />
    </div>
  )
}

export default TapControl
