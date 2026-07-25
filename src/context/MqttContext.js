// MqttContext.js
// Provides the MQTT { status, publish, subscribe, lastMessage } down the tree.
import { createContext, useContext } from 'react'

export const MqttContext = createContext(null)

export function useMqttContext() {
  const ctx = useContext(MqttContext)
  if (!ctx) throw new Error('useMqttContext must be used inside <MqttContext.Provider>')
  return ctx
}
