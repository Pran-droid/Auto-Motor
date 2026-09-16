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

function TapCard({ id, label, timerClass, switchId, switchChecked, isActive, defaultMs, onSwitchChange, onTimerClick, timerRef, editDefaultsMode, defaultIsOn, onImageClick }) {
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
  
  const isImageRotating = editDefaultsMode ? defaultIsOn : isActive
  const imageStyle = editDefaultsMode 
    ? { boxShadow: defaultIsOn ? '0 0 15px 5px rgba(0,255,0,0.5)' : '0 0 15px 5px rgba(255,0,0,0.5)', borderRadius: '50%', cursor: 'pointer' }
    : {}
    
  const greyOutStyle = editDefaultsMode ? { opacity: 0.3, pointerEvents: 'none' } : {}

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
        style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'flex', alignItems: 'center', padding: '0px', marginLeft: '12px', touchAction: 'none', ...greyOutStyle }}
      >
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path fill="#aaa" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </div>
      <img
        src="/assets/valve-Photoroom.png"
        id={`${id}-image`}
        className={`tap-image ${isImageRotating ? 'tap-image-on' : ''}`}
        style={imageStyle}
        alt={`${label} tap valve`}
        onClick={onImageClick}
      />
      <div style={greyOutStyle}>
        <FlipTimer
          ref={timerRef}
          sectionClass={timerClass}
          label={label}
          defaultMs={defaultMs}
          onTimerClick={onTimerClick}
        />
      </div>
      <div style={greyOutStyle}>
        <CosmicSwitch
          id={switchId}
          checked={switchChecked}
          onChange={onSwitchChange}
        />
      </div>
    </div>
  )
}

export default TapCard
