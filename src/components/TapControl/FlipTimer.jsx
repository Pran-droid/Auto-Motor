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
      let html = ''
      
      // Static bottom base card
      html += `
        <div class="new-flp-base-bottom">
           <span>${val}</span>
        </div>
      `
      
      for (let i = 0; i <= 9; i++) {
        const isCurrent = (i === parseInt(val, 10))
        html += `
          <div class="new-flp-num ${isCurrent ? 'is-top' : ''}" data-num="${i}">
             <div class="new-flp-card new-flp-front-top"><span>${i}</span></div>
             <div class="new-flp-card new-flp-back-bottom"><span>${i}</span></div>
          </div>
        `
      }
      el.innerHTML = html
    }

    function setFlap(el, nextVal, noAnim = false) {
      if (!el) return
      const curVal = el.dataset.val
      if (curVal === nextVal) return
      
      const curCard = el.querySelector(`.new-flp-num[data-num="${curVal}"]`)
      const nextCard = el.querySelector(`.new-flp-num[data-num="${nextVal}"]`)
      const baseSpan = el.querySelector('.new-flp-base-bottom span')
      
      if (!curCard || !nextCard || !baseSpan) return
      
      el.dataset.val = nextVal
      
      if (el.dataset.timeoutId) {
        clearTimeout(Number(el.dataset.timeoutId))
        baseSpan.textContent = curVal
      }
      
      el.querySelectorAll('.new-flp-num').forEach(node => {
        node.classList.remove('flip-go', 'is-top')
      })
      
      nextCard.classList.add('is-top')
      
      if (noAnim) {
        baseSpan.textContent = nextVal
        return
      }

      curCard.querySelector('.new-flp-back-bottom span').textContent = nextVal
      
      // Trigger animation
      void curCard.offsetWidth // force reflow
      curCard.classList.add('flip-go')
      
      const tId = setTimeout(() => {
        curCard.classList.remove('flip-go')
        baseSpan.textContent = nextVal
        el.dataset.timeoutId = ''
      }, 500)
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
      setFlap(flaps.m0, m[0], true); setFlap(flaps.m1, m[1], true)
      setFlap(flaps.s0, s[0], true); setFlap(flaps.s1, s[1], true)
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
        <div className="new-flp-clock" role="timer" aria-live="off">
          <div className="new-flp-group">
            <div className="new-flp-digits">
              <div className="new-flp-digit" data-flap="m0"></div>
              <div className="new-flp-digit" data-flap="m1"></div>
            </div>
            <span className="new-flp-glabel">Min</span>
          </div>
          <span className="new-flp-colon" aria-hidden="true">:</span>
          <div className="new-flp-group">
            <div className="new-flp-digits">
              <div className="new-flp-digit" data-flap="s0"></div>
              <div className="new-flp-digit" data-flap="s1"></div>
            </div>
            <span className="new-flp-glabel">Sec</span>
          </div>
        </div>
      </section>
    </div>
  )
})

export default FlipTimer
