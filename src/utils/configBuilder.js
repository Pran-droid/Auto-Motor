// configBuilder.js  — VERSION 2 (ESP32 as DB)
// Builds and publishes the CFG: string directly to MQTT.
// No longer fetches from /api/motor-api.
// Accepts the full config object as a parameter.

/**
 * Publish a full CFG: string to MQTT based on the provided config object.
 * @param {Function} publish  - MQTT publish function from useMqttContext
 * @param {Object}   config   - Full config object with all tap & schedule settings
 */
export function publishFullConfig(publish, config = {}) {
  try {
    const {
      front_enabled = false,
      front_timer = 900000,
      back_enabled = false,
      back_timer = 900000,
      down_enabled = false,
      down_timer = 900000,
      taps_order = '["front-tap","back-tap","down-tap"]',
      schedule_enabled = false,
      start_time = '08:00 AM',
    } = config

    // Parse "HH:MM AM/PM" into 24h hour + minute
    const timeStr = start_time.trim()
    const [time, ampm] = timeStr.split(' ')
    let [h, m] = time.split(':').map(Number)
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0

    const sch = schedule_enabled ? 1 : 0

    // Parse order
    let order = ['front-tap', 'back-tap', 'down-tap']
    if (taps_order) {
      try {
        const parsed = typeof taps_order === 'string' ? JSON.parse(taps_order) : taps_order
        if (Array.isArray(parsed) && parsed.length === 3) order = parsed
      } catch (e) {
        console.error('Failed to parse taps_order', e)
      }
    }

    const pinMap    = { 'front-tap': 4, 'back-tap': 7, 'down-tap': 0 }
    const enableMap = { 'front-tap': front_enabled, 'back-tap': back_enabled, 'down-tap': down_enabled }
    const timerMap = { 'front-tap': front_timer, 'back-tap': back_timer, 'down-tap': down_timer }

    const tapParts = order.map(id =>
      `${pinMap[id]}:${enableMap[id] ? 1 : 0}:${timerMap[id]}`
    ).join(':')

    const finalPayload = `CFG:${tapParts}:${sch}:${h}:${m}`
    console.log('[MQTT V2] Publishing config:', finalPayload)
    publish('home/servo/command', finalPayload)
  } catch (err) {
    console.error('[ConfigBuilder V2] Error publishing config:', err)
  }
}
