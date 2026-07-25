// RockerSwitch.jsx
// 3D illuminated rocker switch. Calls onChange(isOn) when toggled.

function RockerSwitch({ checked, onChange }) {
  return (
    <div id="motor-switch-wrapper">
      <label className="rocker-switch">
        <input
          type="checkbox"
          id="motor-switch"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <div className="button">
          <div className="light"></div>
          <div className="dots"></div>
          <div className="characters"></div>
          <div className="shine"></div>
          <div className="shadow"></div>
        </div>
      </label>
    </div>
  )
}

export default RockerSwitch
