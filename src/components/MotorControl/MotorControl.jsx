// MotorControl.jsx
// Top section: Motor on/off rocker switch + start-time picker.
// Owns schedule state (enabled + start_time) and runs a per-minute scheduler
// that auto-fires the motor ON when the set time is reached and schedule is enabled.

import { useState, useEffect, useRef } from 'react'
import RockerSwitch from './RockerSwitch'
import TimePicker from './TimePicker'
import { useMqttContext } from '../../context/MqttContext'
import { publishFullConfig } from '../../utils/configBuilder'

const TOPIC = 'home/servo/command'



function MotorControl() {
  const [motorOn, setMotorOn] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [startTime, setStartTime] = useState('08:00 AM')
  const { publish, subscribe } = useMqttContext()



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

  // ── Listen for Sequence Complete from ESP32 — auto-reset switch to OFF ──
  useEffect(() => {
    const unsub = subscribe(TOPIC, (payload) => {
      if (payload === 'Sequence Complete') {
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



  // ── Manual switch ──
  async function handleMotorChange(isOn) {
    setMotorOn(isOn)
    if (isOn) {
      await publishFullConfig(publish)
      publish(TOPIC, 'ON')
    } else {
      publish(TOPIC, 'OFF')
    }
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
    })
      .then(() => publishFullConfig(publish, { schedule_enabled: isEnabled }))
      .catch(err => console.error('Failed to update schedule toggle:', err))
  }

  // ── Time change ──
  function handleTimeChange(timeStr) {
    setStartTime(timeStr)
    fetch('/api/motor-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'schedule', start_time: timeStr })
    })
      .then(() => publishFullConfig(publish, { start_time: timeStr }))
      .catch(err => console.error('Failed to update schedule time:', err))
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
