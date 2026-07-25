// MotorControl.jsx
// Top section: Motor on/off rocker switch + start-time picker.
// Owns schedule state (enabled + start_time) and runs a per-minute scheduler
// that auto-fires the motor ON when the set time is reached and schedule is enabled.

import { useState, useEffect, useRef } from 'react'
import RockerSwitch from './RockerSwitch'
import TimePicker from './TimePicker'
import { useMqttContext } from '../../context/MqttContext'

const TOPIC = 'home/servo/command'

// Parse "HH:MM AM/PM" → total minutes from midnight
function parseToMinutes(timeStr) {
  if (!timeStr) return -1
  const [time, ampm] = timeStr.trim().split(' ')
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (ampm === 'AM') {
    if (h === 12) h = 0
  } else {
    if (h !== 12) h += 12
  }
  return h * 60 + m
}

function MotorControl() {
  const [motorOn,         setMotorOn]         = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [startTime,       setStartTime]       = useState('08:00 AM')
  const { publish, subscribe } = useMqttContext()

  // Track whether we already fired the motor today at this scheduled time
  const firedRef = useRef(false)

  // ── Load all state from DB once on mount ──
  useEffect(() => {
    fetch('/api/motor-api')
      .then(res => res.json())
      .then(data => {
        setMotorOn(data.is_on)
        setScheduleEnabled(data.schedule_enabled)
        setStartTime(data.start_time || '08:00 AM')
      })
      .catch(err => console.error('Failed to load motor status:', err))
  }, [])

  // ── Listen for SEQUENCE_DONE from ESP32 — auto-reset switch to OFF ──
  useEffect(() => {
    const unsub = subscribe(TOPIC, (payload) => {
      if (payload === 'SEQUENCE_DONE') {
        console.log('[MQTT] Sequence done — resetting motor switch')
        setMotorOn(false)
        fetch('/api/motor-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'status', is_on: false })
        }).catch(err => console.error('Failed to reset motor status:', err))
      }
    })
    return unsub
  }, [subscribe])

  // ── Scheduler: check every 30 seconds if it's time to fire ──
  useEffect(() => {
    function checkSchedule() {
      if (!scheduleEnabled || motorOn) return

      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const targetMins = parseToMinutes(startTime)

      if (nowMins === targetMins) {
        if (!firedRef.current) {
          console.log(`[Scheduler] Auto-starting motor at ${startTime}`)
          firedRef.current = true
          setMotorOn(true)
          publish(TOPIC, 'ON')
          fetch('/api/motor-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'status', is_on: true })
          }).catch(err => console.error('Failed to auto-start motor:', err))
        }
      } else {
        // Reset the fired guard once the minute has passed
        firedRef.current = false
      }
    }

    const interval = setInterval(checkSchedule, 30000)
    checkSchedule() // also run immediately on mount / state change
    return () => clearInterval(interval)
  }, [scheduleEnabled, startTime, motorOn, publish])

  // ── Manual switch ──
  function handleMotorChange(isOn) {
    setMotorOn(isOn)
    publish(TOPIC, isOn ? 'ON' : 'OFF')
    fetch('/api/motor-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'status', is_on: isOn })
    }).catch(err => console.error('Failed to update motor status:', err))
  }

  // ── Schedule toggle ──
  function handleToggle(isEnabled) {
    setScheduleEnabled(isEnabled)
    fetch('/api/motor-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'schedule_toggle', schedule_enabled: isEnabled })
    }).catch(err => console.error('Failed to update schedule toggle:', err))
  }

  // ── Time change ──
  function handleTimeChange(timeStr) {
    setStartTime(timeStr)
    firedRef.current = false // allow re-fire on new time
    fetch('/api/motor-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'schedule', start_time: timeStr })
    }).catch(err => console.error('Failed to update schedule time:', err))
  }

  return (
    <div id="motor-main-container">
      <h3>Motor Control</h3>
      <div id="motor-switch-container">
        <RockerSwitch checked={motorOn} onChange={handleMotorChange} />
        <TimePicker
          enabled={scheduleEnabled}
          display={startTime}
          onToggle={handleToggle}
          onTimeChange={handleTimeChange}
        />
      </div>
    </div>
  )
}

export default MotorControl
