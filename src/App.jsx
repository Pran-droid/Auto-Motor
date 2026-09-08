import { useState } from 'react'
import MotorControl from './components/MotorControl/MotorControl'
import TapControl from './components/TapControl/TapControl'
import CloudSyncIcon from './components/CloudSync/CloudSyncIcon'
import EspStatusGear from './components/CloudSync/EspStatusGear'
import { useMqtt } from './hooks/useMqtt'
import { MqttContext } from './context/MqttContext'

function App() {
  const mqtt = useMqtt()
  // Populated once ESP32 replies to GET_CFG with CFG_SYNC
  const [espConfig, setEspConfig] = useState(null)

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
        <MotorControl onConfigSync={setEspConfig} />
        <TapControl initialConfig={espConfig} />
      </div>
    </MqttContext.Provider>
  )
}

export default App
