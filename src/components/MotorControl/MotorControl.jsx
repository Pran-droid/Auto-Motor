// MotorControl.jsx — VERSION 2 (ESP32 as DB)
// Motor on/off + schedule. Loads config from ESP32 flash via MQTT GET_CFG.
// No Postgres / /api/motor-api calls.

import { useState, useEffect } from 'react'
import RockerSwitch from './RockerSwitch'
import TimePicker from './TimePicker'
import { useMqttContext } from '../../context/MqttContext'
import { publishFullConfig } from '../../utils/configBuilder'

const TOPIC_CMD    = 'home/servo/command'
const TOPIC_STATUS = 'home/servo/status'

function MotorControl({ onConfigSync }) {
  const [motorOn, setMotorOn] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [startTime, setStartTime] = useState('08:00 AM')
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
    const unsub = subscribe(TOPIC_STATUS, (payload) => {

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
        // tap1: pin=restParts[2], en=restParts[3], ms=restParts[4]
        // tap2: pin=restParts[5], en=restParts[6], ms=restParts[7]
        // tap3: pin=restParts[8], en=restParts[9], ms=restParts[10]
        // order = restParts[11] (e.g. "front-tap,back-tap,down-tap")
        const pinMap   = { '8': 'front-tap', '4': 'back-tap', '0': 'down-tap' }
        const tapsData = {}
        for (let i = 0; i < 3; i++) {
          const pin = restParts[2 + i * 3]
          const en  = restParts[3 + i * 3] === '1'
          const ms  = parseInt(restParts[4 + i * 3], 10)
          const id  = pinMap[pin]
          if (id) tapsData[id] = { enabled: en, timer: ms }
        }
        const orderStr = restParts[11] || 'front-tap,back-tap,down-tap'
        const order    = orderStr.split(',').map(s => s.trim())

        setScheduleEnabled(schEn)
        setStartTime(timeStr)

        // Bubble the full config up to App so TapControl can use it
        if (onConfigSync) {
          onConfigSync({
            schedule_enabled: schEn,
            start_time: timeStr,
            front_enabled: tapsData['front-tap']?.enabled ?? false,
            front_timer:   tapsData['front-tap']?.timer   ?? 900000,
            back_enabled:  tapsData['back-tap']?.enabled  ?? false,
            back_timer:    tapsData['back-tap']?.timer    ?? 900000,
            down_enabled:  tapsData['down-tap']?.enabled  ?? false,
            down_timer:    tapsData['down-tap']?.timer    ?? 900000,
            taps_order:    JSON.stringify(order),
          })
        }
      }

      // Auto-reset switch to OFF when sequence finishes
      if (payload === 'Sequence Complete') {
        console.log('[MQTT] Sequence done — resetting motor switch')
        setMotorOn(false)
      }
    })
    return unsub
  }, [subscribe, onConfigSync])

  // ── Manual motor switch ──
  function handleMotorChange(isOn) {
    setMotorOn(isOn)
    if (isOn) {
      // ON: first send current config so ESP32 has latest, then start
      publish(TOPIC_CMD, 'GET_CFG') // make sure ESP has latest before ON
      setTimeout(() => publish(TOPIC_CMD, 'ON'), 300)
    } else {
      publish(TOPIC_CMD, 'OFF')
    }
  }

  // ── Schedule toggle — publish CFG directly, no DB ──
  function handleToggle(isEnabled) {
    setScheduleEnabled(isEnabled)
    publishFullConfig(publish, {
      schedule_enabled: isEnabled,
      start_time: startTime,
    })
  }

  // ── Time change — publish CFG directly, no DB ──
  function handleTimeChange(timeStr) {
    setStartTime(timeStr)
    publishFullConfig(publish, {
      schedule_enabled: scheduleEnabled,
      start_time: timeStr,
    })
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
