// FlipTimer.jsx
// Flip-clock countdown display.
// Props:
//   sectionClass  – CSS class for the <section> (e.g. 'flip-timer-front')
//   timerRef      – ref that parent exposes (receives { restart })
//   onTimerClick  – called when user clicks the timer area to open setter popup

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

const FlipTimer = forwardRef(function FlipTimer({ sectionClass, label, onTimerClick, defaultMs = 15 * 60 * 1000 }, ref) {
  const sectionRef = useRef(null)
  const ctrlRef    = useRef(null)
  const durationRef = useRef(defaultMs)

  useImperativeHandle(ref, () => ({
    set(ms) { 
      durationRef.current = ms
      ctrlRef.current?.set(ms) 
    },
    start() {
      ctrlRef.current?.start()
    },
    stop() {
      ctrlRef.current?.stop()
    },
    getDurationMs() { return durationRef.current }
  }))

  useEffect(() => {
    const sectionEl = sectionRef.current
    if (!sectionEl) return

    function buildFlap(el, val) {
      el.dataset.val = val
      el.innerHTML =
        '<div class="cdt-flp__card cdt-flp__top"><span>'    + val + '</span></div>' +
        '<div class="cdt-flp__card cdt-flp__bottom"><span>' + val + '</span></div>' +
        '<div class="cdt-flp__flip-top"><span>'             + val + '</span></div>' +
        '<div class="cdt-flp__flip-bottom"><span>'          + val + '</span></div>'
    }

    function setFlap(el, next) {
      if (!el) return
      const cur = el.dataset.val
      if (cur === next) return
      
      // Clear any pending animation timeout
      if (el.dataset.timeoutId) {
        clearTimeout(Number(el.dataset.timeoutId))
        // Instantly force previous animation to complete state
        el.querySelector('.cdt-flp__bottom span').textContent = cur
      }

      el.querySelector('.cdt-flp__top span').textContent         = next
      el.querySelector('.cdt-flp__bottom span').textContent      = cur
      el.querySelector('.cdt-flp__flip-top span').textContent    = cur
      el.querySelector('.cdt-flp__flip-bottom span').textContent = next
      
      // Update data immediately so rapid calls see the target state
      el.dataset.val = next
      
      el.classList.remove('cdt-flp--go')
      void el.offsetWidth
      el.classList.add('cdt-flp--go')
      
      const tId = setTimeout(() => {
        el.querySelector('.cdt-flp__bottom span').textContent = next
        el.dataset.timeoutId = ''
      }, 600)
      el.dataset.timeoutId = tId
    }

    const flaps = {
      m0: sectionEl.querySelector('[data-flap="m0"]'),
      m1: sectionEl.querySelector('[data-flap="m1"]'),
      s0: sectionEl.querySelector('[data-flap="s0"]'),
      s1: sectionEl.querySelector('[data-flap="s1"]'),
    }
    Object.values(flaps).forEach(f => buildFlap(f, '0'))

    const pad = n => String(n).padStart(2, '0')
    let intervalId = null
    let target

    function render() {
      const diff = Math.max(0, target - Date.now())
      const m = pad(Math.floor((diff % 3600000) / 60000))
      const s = pad(Math.floor((diff % 60000)  / 1000))
      setFlap(flaps.m0, m[0]); setFlap(flaps.m1, m[1])
      setFlap(flaps.s0, s[0]); setFlap(flaps.s1, s[1])
    }

    function renderStatic(ms) {
      const m = pad(Math.floor((ms % 3600000) / 60000))
      const s = pad(Math.floor((ms % 60000)  / 1000))
      setFlap(flaps.m0, m[0]); setFlap(flaps.m1, m[1])
      setFlap(flaps.s0, s[0]); setFlap(flaps.s1, s[1])
    }

    function set(ms) {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      renderStatic(ms)
    }

    function start() {
      if (intervalId) clearInterval(intervalId)
      target = Date.now() + durationRef.current
      render()
      intervalId = setInterval(render, 1000)
    }

    function stop() {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      renderStatic(durationRef.current)
    }

    ctrlRef.current = { set, start, stop }
    set(defaultMs) // Initialize frozen

    return () => { if (intervalId) clearInterval(intervalId) }
  }, []) // eslint-disable-line

  return (
    <div className="flip-main-timer" onClick={onTimerClick}>
      <h4>{label}</h4>
      <section className={sectionClass} ref={sectionRef}>
        <div className="cdt-flp__clock" role="timer" aria-live="off">
          <div className="cdt-flp__group">
            <div className="cdt-flp__digits">
              <div className="cdt-flp__flap" data-flap="m0"></div>
              <div className="cdt-flp__flap" data-flap="m1"></div>
            </div>
            <span className="cdt-flp__glabel">Min</span>
          </div>
          <span className="cdt-flp__colon" aria-hidden="true">:</span>
          <div className="cdt-flp__group">
            <div className="cdt-flp__digits">
              <div className="cdt-flp__flap" data-flap="s0"></div>
              <div className="cdt-flp__flap" data-flap="s1"></div>
            </div>
            <span className="cdt-flp__glabel">Sec</span>
          </div>
        </div>
      </section>
    </div>
  )
})

export default FlipTimer
