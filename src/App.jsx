import { useState, useRef, useCallback } from 'react'
import MotorControl from './components/MotorControl/MotorControl'
import TapControl from './components/TapControl/TapControl'
import CloudSyncIcon from './components/CloudSync/CloudSyncIcon'
import EspStatusGear from './components/CloudSync/EspStatusGear'
import SaveButton from './components/SaveButton/SaveButton'
import SuccessToast from './components/SuccessToast/SuccessToast'
import { useMqtt } from './hooks/useMqtt'
import { MqttContext } from './context/MqttContext'
import { publishFullConfig } from './utils/configBuilder'

function App() {
  const mqtt = useMqtt()
  // Populated once ESP32 replies to GET_CFG with CFG_SYNC
  const [espConfig, setEspConfig] = useState(null)
  // What the UI shows: ESP32 config with any unsaved changes layered on top.
  // Only recomputed on CFG_SYNC so local edits don't re-trigger child sync effects.
  const [viewConfig, setViewConfig] = useState(null)

  // Track any UI changes that haven't been saved yet
  const [pendingChanges, setPendingChanges] = useState({})
  const pendingRef = useRef({})
  // True between publishing CFG: and receiving the ESP32's CFG_SYNC acknowledgement
  const awaitingAckRef = useRef(false)

  // Toast state
  const [showToast, setShowToast] = useState(false)

  // Edit Defaults Mode
  const [editDefaultsMode, setEditDefaultsMode] = useState(false)

  const isDirty = Object.keys(pendingChanges).length > 0
  const canSave = mqtt.status === 'connected' && mqtt.espStatus === 'connected' && espConfig !== null

  const handleConfigSync = useCallback((config) => {
    setEspConfig(config)
    if (awaitingAckRef.current) {
      // CFG_SYNC after our save — the ESP32 has stored the config
      awaitingAckRef.current = false
      pendingRef.current = {}
      setPendingChanges({})
      setViewConfig(config)
      setShowToast(true)
    } else {
      // Background sync (reconnect, another device) — keep unsaved edits
      setViewConfig({ ...config, ...pendingRef.current })
    }
  }, [])

  const handleLocalChange = useCallback((changes) => {
    pendingRef.current = { ...pendingRef.current, ...changes }
    setPendingChanges(pendingRef.current)
  }, [])

  function handleSave() {
    if (!canSave) return
    const finalConfig = { ...espConfig, ...pendingChanges }
    if (publishFullConfig(mqtt.publish, finalConfig)) {
      awaitingAckRef.current = true
      setEditDefaultsMode(false)
    }
    // pendingChanges clear when ESP32 replies with CFG_SYNC in handleConfigSync
  }

  return (
    <MqttContext.Provider value={mqtt}>
      <div id="app-container">
        {/* Cloud/MQTT broker status — top RIGHT */}
        <div id="cloud-status-badge" title={`MQTT Broker: ${mqtt.status}`}>
          <CloudSyncIcon status={mqtt.status} />
        </div>

        {/* ESP32 hardware status — top LEFT */}
        <div id="esp-status-badge" title={`ESP32: ${mqtt.espStatus}`}>
          <EspStatusGear status={mqtt.espStatus} />
        </div>

        <MotorControl
          config={viewConfig}
          onConfigSync={handleConfigSync}
          onChange={handleLocalChange}
          editDefaultsMode={editDefaultsMode}
        />
        <TapControl
          initialConfig={viewConfig}
          onChange={handleLocalChange}
          editDefaultsMode={editDefaultsMode}
          setEditDefaultsMode={setEditDefaultsMode}
        />

        <SaveButton isDirty={isDirty} canSave={canSave} onSave={handleSave} />

        <SuccessToast
          show={showToast}
          onClose={() => setShowToast(false)}
          message="Saved Successfully!"
          subText="Everything seems great"
        />
      </div>
    </MqttContext.Provider>
  )
}

export default App
