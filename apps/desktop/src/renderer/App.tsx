import { useState } from 'react'
import type { ChannelState, User } from '@telacast/shared'
import { getSavedUser, getToken, saveUser, setToken } from './lib/api'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Room from './screens/Room'

export default function App() {
  const [user, setUser] = useState<User | null>(() => (getToken() ? getSavedUser() : null))
  const [channel, setChannel] = useState<ChannelState | null>(null)

  const logout = () => {
    setToken(null)
    saveUser(null)
    setUser(null)
  }

  if (!user) {
    return (
      <Auth
        onDone={(token, u) => {
          setToken(token)
          saveUser(u)
          setUser(u)
        }}
      />
    )
  }
  if (channel) return <Room me={user} channel={channel} onLeave={() => setChannel(null)} />
  return <Home user={user} onChannel={setChannel} onLogout={logout} />
}
