// useMqtt.js
// Custom hook that manages the MQTT connection to HiveMQ Cloud.
// Connects over secure WebSocket (wss://) using the mqtt.js browser client.
// Returns: { status, publish, subscribe, lastMessage }

import { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

const MQTT_HOST   = 'wss://3ced25e5a1194f8d822b5903ac4fa001.s1.eu.hivemq.cloud:8884/mqtt'
const MQTT_USER   = 'Pran'
const MQTT_PASS   = 'automotor'
const CLIENT_ID   = `web-${Math.random().toString(16).slice(2, 8)}`

export function useMqtt() {
  const [status,      setStatus]      = useState('idle')      // idle | connecting | connected | error
  const [lastMessage, setLastMessage] = useState(null)         // { topic, payload }
  const clientRef    = useRef(null)
  const handlersRef  = useRef({})     // topic → [callback] map

  useEffect(() => {
    // Only create the client once
    if (!clientRef.current) {
      setStatus('connecting')
      const c = mqtt.connect(MQTT_HOST, {
        clientId:  CLIENT_ID,
        username:  MQTT_USER,
        password:  MQTT_PASS,
        keepalive: 60,
        reconnectPeriod: 3000,
      })

      c.on('connect', () => {
        console.log('[MQTT] connected')
        setStatus('connected')
        // Automatically resubscribe to any topics we registered for
        Object.keys(handlersRef.current).forEach(topic => {
          c.subscribe(topic)
        })
      })

      c.on('reconnect', () => {
        console.log('[MQTT] reconnecting…')
        setStatus('connecting')
      })

      c.on('error', (err) => {
        console.error('[MQTT] error', err)
        setStatus('error')
      })

      c.on('offline', () => {
        console.warn('[MQTT] offline')
        setStatus('error')
      })

      c.on('message', (topic, payloadBuf) => {
        const payload = payloadBuf.toString()
        console.log(`[MQTT] ← ${topic}: ${payload}`)
        setLastMessage({ topic, payload })
        const handlers = handlersRef.current[topic] || []
        handlers.forEach(fn => fn(payload, topic))
      })

      clientRef.current = c
    }

    return () => {
      // In StrictMode, this cleanup will run immediately. 
      // mqtt.js handles multiple disconnects gracefully.
      // We do NOT clear clientRef.current here so the connection is reused.
    }
  }, [])

  /** Publish a message to a topic */
  const publish = useCallback((topic, message) => {
    if (!clientRef.current?.connected) {
      console.warn('[MQTT] publish skipped – not connected')
      return
    }
    clientRef.current.publish(topic, String(message))
    console.log(`[MQTT] → ${topic}: ${message}`)
  }, [])

  /** Subscribe to a topic and call callback(payload, topic) on each message */
  const subscribe = useCallback((topic, callback) => {
    if (!handlersRef.current[topic]) {
      handlersRef.current[topic] = []
      // If connected, subscribe immediately. If not, it will subscribe in the 'connect' event.
      if (clientRef.current?.connected) {
        clientRef.current.subscribe(topic, err => {
          if (err) console.error(`[MQTT] subscribe error for ${topic}`, err)
        })
      }
    }
    handlersRef.current[topic].push(callback)
    return () => {
      handlersRef.current[topic] = handlersRef.current[topic].filter(fn => fn !== callback)
    }
  }, [])

  return { status, publish, subscribe, lastMessage }
}
