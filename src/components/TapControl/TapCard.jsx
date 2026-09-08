// TapCard.jsx
// ★ The core repeating component — uses @dnd-kit/sortable for drag-and-drop.
// Props:
//   id              – unique string id (e.g. 'front-tap')
//   label           – display label (e.g. 'Front')
//   timerClass      – CSS class for the flip timer section
//   switchId        – id for the cosmic switch checkbox
//   switchChecked   – controlled bool
//   onSwitchChange  – fn(isOn: bool)
//   onTimerClick    – fn() opens the shared timer setter popup
//   timerRef        – ref callback to expose the FlipTimer imperative handle

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import FlipTimer from './FlipTimer'
import CosmicSwitch from './CosmicSwitch'

function TapCard({ id, label, timerClass, switchId, switchChecked, isActive, defaultMs, onSwitchChange, onTimerClick, timerRef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 999 : 1,
    position: 'relative',
  }

  return (
    <div
      id={id}
      className="tap-item"
      ref={setNodeRef}
      style={style}
    >
      <div
        className="drag-handle"
        {...attributes}
        {...listeners}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'flex', alignItems: 'center', padding: '0px', marginLeft: '12px', touchAction: 'none' }}
      >
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path fill="#aaa" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </div>
      <img
        src="/assets/valve-Photoroom.png"
        id={`${id}-image`}
        className={`tap-image ${isActive ? 'tap-image-on' : ''}`}
        alt={`${label} tap valve`}
      />
      <FlipTimer
        ref={timerRef}
        sectionClass={timerClass}
        label={label}
        defaultMs={defaultMs}
        onTimerClick={onTimerClick}
      />
      <CosmicSwitch
        id={switchId}
        checked={switchChecked}
        onChange={onSwitchChange}
      />
    </div>
  )
}

export default TapCard
