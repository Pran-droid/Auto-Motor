// TimerSetterPopup.jsx
// Shared popup for setting a countdown timer duration (minutes + seconds).
// Always renders (hidden via CSS) so refs are always attached.
// Props:
//   open    – bool
//   title   – string
//   onClose – fn()
//   onSet   – fn(ms: number)

import { useEffect, useRef } from 'react'

const WHEEL_ITEM_H = 40

function TimerSetterPopup({ open, title, onClose, onSet }) {
  const wheelMinsRef = useRef(null)
  const wheelSecsRef = useRef(null)
  const innerMinsRef = useRef(null)
  const innerSecsRef = useRef(null)

  // Populate wheels once — guard against StrictMode double-invoke and null refs
  useEffect(() => {
    ;[innerMinsRef, innerSecsRef].forEach(innerRef => {
      if (!innerRef.current) return
      if (innerRef.current.children.length > 0) return // already populated
      // Create 100 sets of 60 items (6000 items) for infinite scroll illusion
      for (let i = 0; i < 6000; i++) {
        const div = document.createElement('div')
        div.className = 'timer-wheel-item'
        div.textContent = String(i % 60).padStart(2, '0')
        innerRef.current.appendChild(div)
      }
    })
  }, [])

  // When popup opens, scroll to default values and refresh active state
  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      // Start in the middle set (index 3000)
      scrollWheelTo(wheelMinsRef.current, 3000 + 15)
      scrollWheelTo(wheelSecsRef.current, 3000 + 0)
      refreshActive(wheelMinsRef.current, innerMinsRef.current)
      refreshActive(wheelSecsRef.current, innerSecsRef.current)
    }, 50)
  }, [open])

  function scrollWheelTo(wheel, v, smooth = false) {
    if (!wheel) return
    wheel.scrollTo({ top: v * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'auto' })
  }

  function getWheelVal(wheel) { return Math.round(wheel.scrollTop / WHEEL_ITEM_H) }

  function refreshActive(wheel, inner) {
    if (!wheel || !inner) return
    const idx = getWheelVal(wheel)
    
    // Efficiently update active state without iterating 6000 items
    const activeOld = inner.querySelector('.timer-wheel-item.active')
    if (activeOld) activeOld.classList.remove('active')
    
    const activeNew = inner.children[idx]
    if (activeNew) activeNew.classList.add('active')
  }

  function handleSet() {
    const minVal = getWheelVal(wheelMinsRef.current) % 60
    const secVal = getWheelVal(wheelSecsRef.current) % 60
    const ms = (minVal * 60 + secVal) * 1000
    if (ms > 0) onSet(ms)
    onClose()
  }

  // Always render — visibility controlled by CSS class
  return (
    <div
      id="timer-setter-overlay"
      className={open ? 'open' : ''}
      onClick={e => { if (e.target.id === 'timer-setter-overlay') onClose() }}
    >
      <div id="timer-setter-popup">
        <div id="timer-setter-title">{title}</div>
        <div className="timer-picker-container">
          <div className="timer-highlight-bar"></div>
          <div className="timer-labels">
            <span>min</span>
            <span>sec</span>
          </div>
          <div
            className="timer-wheel"
            id="setter-wheel-mins"
            ref={wheelMinsRef}
            onScroll={() => refreshActive(wheelMinsRef.current, innerMinsRef.current)}
          >
            <div className="timer-wheel-inner" id="setter-inner-mins" ref={innerMinsRef}></div>
          </div>
          <div
            className="timer-wheel"
            id="setter-wheel-secs"
            ref={wheelSecsRef}
            onScroll={() => refreshActive(wheelSecsRef.current, innerSecsRef.current)}
          >
            <div className="timer-wheel-inner" id="setter-inner-secs" ref={innerSecsRef}></div>
          </div>
        </div>
        <div className="timer-setter-actions">
          <button id="timer-setter-cancel" onClick={onClose}>Cancel</button>
          <button id="timer-setter-set"    onClick={handleSet}>Set</button>
        </div>
      </div>
    </div>
  )
}

export default TimerSetterPopup
