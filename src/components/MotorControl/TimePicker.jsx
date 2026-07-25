// TimePicker.jsx
// iOS-style time toggle + scroll-wheel time picker popup.
// State (enabled, display) is now owned by the parent (MotorControl).
// Props:
//   enabled       – bool
//   display       – string e.g. "08:30 AM"
//   onToggle      – fn(isEnabled: bool)
//   onTimeChange  – fn(timeStr: string)

import { useState, useEffect, useRef } from 'react'

const ITEM_H = 42 // px – matches CSS .scroll-item height

// ── Build an array of items for hours, minutes, ampm ──
function buildHours()   { return Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1).padStart(2, '0'), value: i + 1 })) }
function buildMinutes() { return Array.from({ length: 60 }, (_, i) => ({ label: String(i).padStart(2, '0'), value: i })) }
const AMPM_ITEMS = [{ label: 'AM', value: 'AM' }, { label: 'PM', value: 'PM' }]

// ── Reusable scroll column ──
function ScrollColumn({ items, initialIndex, onChange, wrap = false }) {
  const wheelRef = useRef(null)
  
  const multiplier = wrap ? 50 : 1
  const displayItems = wrap ? Array(multiplier).fill(items).flat() : items
  const baseIndex = wrap ? (Math.floor(multiplier / 2) * items.length) : 0
  
  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.scrollTo({ top: (baseIndex + initialIndex) * ITEM_H, behavior: 'auto' })
    }
  }, [baseIndex, initialIndex])
  
  function handleScroll(e) {
    const idx = Math.round(e.target.scrollTop / ITEM_H)
    const actualIdx = idx % items.length
    
    const inner = e.target.querySelector('.scroll-list-native')
    if (inner) {
      const activeOlds = inner.querySelectorAll('.scroll-item.selected')
      activeOlds.forEach(el => el.classList.remove('selected'))
      const activeNew = inner.children[idx]
      if (activeNew) activeNew.classList.add('selected')
    }
    
    onChange(actualIdx)
  }

  return (
    <div 
      className="scroll-wheel-native" 
      ref={wheelRef} 
      onScroll={handleScroll}
      style={{
        height: '100%', 
        overflowY: 'scroll', 
        scrollSnapType: 'y mandatory', 
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      <style>{`.scroll-wheel-native::-webkit-scrollbar { display: none; }`}</style>
      <div className="scroll-list-native" style={{ padding: '54px 0', transition: 'none' }}>
        {displayItems.map((item, i) => (
          <div 
            key={i} 
            className={`scroll-item ${i === baseIndex + initialIndex ? 'selected' : ''}`} 
            style={{ scrollSnapAlign: 'center', height: ITEM_H, lineHeight: `${ITEM_H}px` }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main TimePicker component ──
function TimePicker({ enabled, display, onToggle, onTimeChange }) {
  const [popupOpen, setPopupOpen] = useState(false)

  // picker state – sync from display whenever popup opens
  const pickerRef = useRef({ hour: 8, minute: 0, ampm: 'AM' })

  function openPopup() {
    if (!enabled) return
    const [time, ampm] = (display || '08:00 AM').split(' ')
    const [h, m] = time.split(':')
    pickerRef.current = { hour: parseInt(h, 10), minute: parseInt(m, 10), ampm }
    setPopupOpen(true)
  }

  function handleOk() {
    const { hour, minute, ampm } = pickerRef.current
    const h = String(hour).padStart(2, '0')
    const m = String(minute).padStart(2, '0')
    const timeStr = `${h}:${m} ${ampm}`
    setPopupOpen(false)
    onTimeChange(timeStr)
  }

  return (
    <div id="time-section">
      {/* Toggle row */}
      <div id="time-toggle-row">
        <span id="time-toggle-label">Start Time</span>
        <label className="tgl">
          <input
            type="checkbox"
            id="time-toggle"
            checked={enabled}
            onChange={e => {
              const isEnabled = e.target.checked
              if (!isEnabled) setPopupOpen(false)
              onToggle(isEnabled)
            }}
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* Time display button */}
      <div
        id="time-input"
        role="button"
        aria-label="Set time"
        className={enabled ? 'visible' : ''}
        onClick={openPopup}
      >
        <span id="time-display">{display}</span>
      </div>

      {/* Popup overlay */}
      <div
        id="time-picker-overlay"
        className={popupOpen ? 'open' : ''}
        onClick={e => { if (e.target.id === 'time-picker-overlay') setPopupOpen(false) }}
      >
        <div id="time-picker-popup">
          <div className="time-picker-title">Select Time</div>
          <div className="time-picker-body">
            {popupOpen && (
              <>
                <div className="scroll-column" id="col-hours">
                  <ScrollColumn
                    items={buildHours()}
                    initialIndex={pickerRef.current.hour - 1}
                    onChange={idx => { pickerRef.current.hour = idx + 1 }}
                    wrap={true}
                  />
                </div>
                <div className="time-colon">:</div>
                <div className="scroll-column" id="col-minutes">
                  <ScrollColumn
                    items={buildMinutes()}
                    initialIndex={pickerRef.current.minute}
                    onChange={idx => { pickerRef.current.minute = idx }}
                    wrap={true}
                  />
                </div>
                <div className="scroll-column" id="col-ampm">
                  <ScrollColumn
                    items={AMPM_ITEMS}
                    initialIndex={pickerRef.current.ampm === 'AM' ? 0 : 1}
                    onChange={idx => { pickerRef.current.ampm = idx === 0 ? 'AM' : 'PM' }}
                  />
                </div>
              </>
            )}
            <div className="picker-selector"></div>
          </div>
          <div className="time-picker-actions">
            <button id="picker-cancel" onClick={() => setPopupOpen(false)}>Cancel</button>
            <button id="picker-ok"     onClick={handleOk}>OK</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimePicker
