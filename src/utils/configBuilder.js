export async function publishFullConfig(publish, localOverrides = {}) {
  try {
    // 1. Fetch latest state from the database
    const res = await fetch('/api/motor-api')
    if (!res.ok) throw new Error('Failed to fetch from motor-api')
    const data = await res.json()

    // 2. Merge any local overrides (e.g. a switch that was just toggled)
    const merged = { ...data, ...localOverrides }

    // 3. Parse the time string "HH:MM AM/PM" into hour and minute
    const timeStr = merged.start_time || '08:00 AM'
    const [time, ampm] = timeStr.trim().split(' ')
    let [h, m] = time.split(':').map(Number)
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0

    // 4. Parse schedule enabled flag
    const sch = merged.schedule_enabled ? 1 : 0

    // 5. Build tap parts based on current sort order
    let order = ['front-tap', 'back-tap', 'down-tap']
    if (merged.taps_order) {
      try {
        order = JSON.parse(merged.taps_order)
      } catch (e) {
        console.error('Failed to parse taps_order', e)
      }
    }

    const pinMap = { 'front-tap': 8, 'back-tap': 11, 'down-tap': 7 }
    
    // Create the tap sequence parts (pin:en:ms)
    const tapParts = order.map(id => {
      const prefix = id.split('-')[0] // "front", "back", "down"
      const en = merged[`${prefix}_enabled`] ? 1 : 0
      const ms = merged[`${prefix}_timer`] || 900000
      return `${pinMap[id]}:${en}:${ms}`
    }).join(':')

    // 6. Final CFG payload: CFG:pin1:en1:ms1:pin2:en2:ms2:pin3:en3:ms3:scheduleEnabled:hour:minute
    const finalPayload = `CFG:${tapParts}:${sch}:${h}:${m}`
    console.log('[MQTT] Publishing unified config:', finalPayload)
    publish('home/servo/command', finalPayload)
  } catch (err) {
    console.error('[ConfigBuilder] Error publishing full config:', err)
  }
}
