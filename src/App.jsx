import { useState } from 'react'
import MotorControl from './components/MotorControl/MotorControl'
import TapControl from './components/TapControl/TapControl'
import CloudSyncIcon from './components/CloudSync/CloudSyncIcon'
import EspStatusGear from './components/CloudSync/EspStatusGear'
import SaveButton from './components/SaveButton/SaveButton'
import SuccessToast from './components/SuccessToast/SuccessToast'
import { useMqtt } from './hooks/useMqtt'
import { MqttContext } from './context/MqttContext'
import { publishFullConfig } from './utils/configBuilder'
import { useCallback } from 'react'

function App() {
  const mqtt = useMqtt()
  // Populated once ESP32 replies to GET_CFG with CFG_SYNC
  const [espConfig, setEspConfig] = useState(null)
  
  // Track any UI changes that haven't been saved yet
  const [pendingChanges, setPendingChanges] = useState({})
  
  // Toast state
  const [showToast, setShowToast] = useState(false)
  
  const isDirty = Object.keys(pendingChanges).length > 0

  const handleConfigSync = useCallback((config) => {
    setEspConfig(config)
    setPendingChanges(prev => {
      // If we had pending changes when CFG_SYNC arrives, it means our save was acknowledged!
      if (Object.keys(prev).length > 0) {
        setShowToast(true)
      }
      return {} // Clear dirty state
    })
  }, [])

  const handleLocalChange = useCallback((changes) => {
    setPendingChanges(prev => ({ ...prev, ...changes }))
  }, [])

  function handleSave() {
    if (!espConfig) return
    const finalConfig = { ...espConfig, ...pendingChanges }
    publishFullConfig(mqtt.publish, finalConfig)
    // We don't clear pendingChanges here immediately; 
    // it will clear when ESP32 replies with CFG_SYNC in handleConfigSync
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
          onConfigSync={handleConfigSync} 
          onChange={handleLocalChange}
        />
        <TapControl 
          initialConfig={espConfig} 
          onChange={handleLocalChange}
        />
        
        <SaveButton isDirty={isDirty} onSave={handleSave} />
        
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
