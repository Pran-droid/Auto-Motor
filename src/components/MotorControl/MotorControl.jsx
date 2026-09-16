// MotorControl.jsx — VERSION 2 (ESP32 as DB)
// Motor on/off + schedule. Loads config from ESP32 flash via MQTT GET_CFG.
// No Postgres / /api/motor-api calls.

import { useState, useEffect, useRef } from 'react'
import RockerSwitch from './RockerSwitch'
import TimePicker from './TimePicker'
import { useMqttContext } from '../../context/MqttContext'
import { publishFullConfig } from '../../utils/configBuilder'

const TOPIC_CMD    = 'home/servo/command'
const TOPIC_STATUS = 'home/servo/status'

function MotorControl({ onConfigSync, onChange, editDefaultsMode }) {
  const [motorOn, setMotorOn] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [startTime, setStartTime] = useState('08:00 AM')
  // Keep a ref to the latest full config received from ESP32 so we can always
  // publish a complete CFG: without clobbering tap data (Bug 2 fix)
  const fullConfigRef = useRef(null)
  const { publish, subscribe, status } = useMqttContext()

  // ── Request config from ESP32 once MQTT is connected ──
  useEffect(() => {
    if (status !== 'connected') return
    console.log('[V2] MQTT connected — requesting config from ESP32...')
    publish(TOPIC_CMD, 'GET_CFG')
  }, [status, publish])

  // ── Listen for CFG_SYNC reply from ESP32 ──
  // Format: CFG_SYNC:schEn:HH:MM AM/PM:pin1:en1:ms1:pin2:en2:ms2:pin3:en3:ms3:order
  useEffect(() => {
    const unsubStatus = subscribe(TOPIC_STATUS, (payload) => {

      if (payload.startsWith('CFG_SYNC:')) {
        console.log('[V2] CFG_SYNC received:', payload)
        // Remove "CFG_SYNC:" prefix, then split carefully
        // Preserve the time string "HH:MM AM/PM" by splitting only on colons after the time
        const body = payload.substring('CFG_SYNC:'.length)
        // body = "schEn:HH:MM AM/PM:pin1:en1:ms1:..."
        // The time field contains a space so we can't blindly split(':')
        // Instead split on first colon (schEn), then next part is "HH:MM AM/PM" (ends at the first 'M:' or 'M ' pattern)
        const firstColon = body.indexOf(':')
        const schEn = body.substring(0, firstColon) === '1'

        const rest = body.substring(firstColon + 1)
        // rest starts with "HH:MM AM/PM:..."
        // The time string is everything up to the 3rd colon (which starts the tap data)
        // "08:00 AM:8:1:..." — split by ':' gives ["08","00 AM","8","1",...]
        const restParts = rest.split(':')
        // time = "08:00 AM" = restParts[0] + ":" + restParts[1]
        const timeStr = restParts[0] + ':' + restParts[1]  // "08:00 AM"

        // tap data starts at restParts[2]
        // tap1: pin=restParts[2], en=restParts[3], ms=restParts[4], def=restParts[5]
        // tap2: pin=restParts[6], en=restParts[7], ms=restParts[8], def=restParts[9]
        // tap3: pin=restParts[10], en=restParts[11], ms=restParts[12], def=restParts[13]
        // order = restParts[14] (e.g. "front-tap,back-tap,down-tap")
        const pinMap   = { '4': 'front-tap', '7': 'back-tap', '0': 'down-tap' }
        const tapsData = {}
        for (let i = 0; i < 3; i++) {
          const pin = restParts[2 + i * 4]
          const en  = restParts[3 + i * 4] === '1'
          const ms  = parseInt(restParts[4 + i * 4], 10)
          const def = restParts[5 + i * 4] === '1'
          const id  = pinMap[pin]
          if (id) tapsData[id] = { enabled: en, timer: ms, def }
        }
        const orderStr = restParts[14] || 'front-tap,back-tap,down-tap'
        const order    = orderStr.split(',').map(s => s.trim())
        
        const isRunning = restParts[15] === '1'

        setScheduleEnabled(schEn)
        setStartTime(timeStr)
        // Always sync motor switch state with ESP32's reported running state
        setMotorOn(isRunning)

        // Bubble the full config up to App so TapControl can use it
        if (onConfigSync) {
          const synced = {
            schedule_enabled: schEn,
            start_time: timeStr,
            front_enabled: tapsData['front-tap']?.enabled ?? false,
            front_timer:   tapsData['front-tap']?.timer   ?? 900000,
            front_def:     tapsData['front-tap']?.def     ?? false,
            back_enabled:  tapsData['back-tap']?.enabled  ?? false,
            back_timer:    tapsData['back-tap']?.timer    ?? 900000,
            back_def:      tapsData['back-tap']?.def      ?? false,
            down_enabled:  tapsData['down-tap']?.enabled  ?? false,
            down_timer:    tapsData['down-tap']?.timer    ?? 900000,
            down_def:      tapsData['down-tap']?.def      ?? true,
            taps_order:    JSON.stringify(order),
          }
          // Cache it so toggle/time handlers can publish the full config
          fullConfigRef.current = synced
          onConfigSync(synced)
        }
      }

      if (payload === 'Sequence Started') {
        console.log('[MQTT] Sequence started — turning motor switch ON')
        setMotorOn(true)
      } else if (payload.startsWith('Aborted:')) {
        console.log('[MQTT] Sequence aborted — resetting motor switch OFF')
        setMotorOn(false)
      }
    })

    const unsubCmd = subscribe(TOPIC_CMD, (payload) => {
      // Auto-reset switch to OFF when sequence finishes
      if (payload === 'Sequence Complete') {
        console.log('[MQTT] Sequence done — resetting motor switch OFF')
        setMotorOn(false)
      }
    })

    return () => {
      unsubStatus()
      unsubCmd()
    }
  }, [subscribe, onConfigSync])

  // ── Manual motor switch ──
  function handleMotorChange(isOn) {
    setMotorOn(isOn)
    if (isOn) {
      publish(TOPIC_CMD, 'ON')
    } else {
      publish(TOPIC_CMD, 'OFF')
    }
  }

  // ── Schedule toggle — mark as dirty ──
  function handleToggle(isEnabled) {
    setScheduleEnabled(isEnabled)
    if (onChange) {
      onChange({ schedule_enabled: isEnabled, start_time: startTime })
    }
  }

  // ── Time change — mark as dirty ──
  function handleTimeChange(timeStr) {
    setStartTime(timeStr)
    if (onChange) {
      onChange({ schedule_enabled: scheduleEnabled, start_time: timeStr })
    }
  }

  return (
    <div id="motor-main-container" style={editDefaultsMode ? { opacity: 0.3, pointerEvents: 'none' } : {}}>
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
