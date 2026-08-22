import { useState } from 'react'
import MotorControl from './components/MotorControl/MotorControl'
import TapControl from './components/TapControl/TapControl'
import CloudSyncIcon from './components/CloudSync/CloudSyncIcon'
import { useMqtt } from './hooks/useMqtt'
import { MqttContext } from './context/MqttContext'

function App() {
  const mqtt = useMqtt()
  // Populated once ESP32 replies to GET_CFG with CFG_SYNC
  const [espConfig, setEspConfig] = useState(null)

  return (
    <MqttContext.Provider value={mqtt}>
      <div id="app-container">
        {/* Global cloud-sync status badge */}
        <div id="cloud-status-badge" title={`MQTT: ${mqtt.status}`}>
          <CloudSyncIcon status={mqtt.status} />
          {/* <span id="cloud-status-label">{mqtt.status}</span> */}
        </div>
        <MotorControl onConfigSync={setEspConfig} />
        <TapControl initialConfig={espConfig} />
      </div>
    </MqttContext.Provider>
  )
}

export default App
