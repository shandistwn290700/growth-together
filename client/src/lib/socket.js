import { io } from 'socket.io-client'
import { TOKEN_KEY } from './api.js'

let socket = null

// Satu koneksi Socket.IO untuk seluruh aplikasi. Token dibaca ulang setiap kali (re)connect.
export function connectSocket() {
  if (!socket) {
    socket = io({ auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }) })
  }
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
