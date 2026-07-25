// CosmicSwitch.jsx
// Animated cosmic-style toggle switch for each tap.
// Props: id (string), checked (bool), onChange (fn)

function CosmicSwitch({ id, checked, onChange }) {
  return (
    <div className="tap-switch-container">
      <label className="cosmic-toggle">
        <input
          className="csi-toggle"
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <div className="csi-slider">
          <div className="csi-cosmos"></div>
          <div className="csi-energy-line"></div>
          <div className="csi-energy-line"></div>
          <div className="csi-energy-line"></div>
          <div className="csi-orb">
            <div className="csi-inner-orb"></div>
            <div className="csi-ring"></div>
          </div>
          <div className="csi-particles">
            <div style={{ '--angle': '30deg'  }} className="csi-particle"></div>
            <div style={{ '--angle': '60deg'  }} className="csi-particle"></div>
            <div style={{ '--angle': '90deg'  }} className="csi-particle"></div>
            <div style={{ '--angle': '120deg' }} className="csi-particle"></div>
            <div style={{ '--angle': '150deg' }} className="csi-particle"></div>
            <div style={{ '--angle': '180deg' }} className="csi-particle"></div>
          </div>
        </div>
      </label>
    </div>
  )
}

export default CosmicSwitch
