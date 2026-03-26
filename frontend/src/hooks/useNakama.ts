import { useState, useCallback, useRef } from 'react';
import { Client, Session, Socket } from '@heroiclabs/nakama-js';

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || 'localhost';
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';
const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';

export function useNakama() {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new Client(
        NAKAMA_SERVER_KEY,
        NAKAMA_HOST,
        NAKAMA_PORT,
        NAKAMA_USE_SSL
      );
    }
    return clientRef.current;
  }, []);

  const authenticate = useCallback(async (username?: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const client = getClient();

      // Try to restore session from localStorage
      const storedToken = localStorage.getItem('nakama_token');
      const storedRefreshToken = localStorage.getItem('nakama_refresh_token');
      let sess: Session | null = null;

      if (storedToken && storedRefreshToken) {
        sess = Session.restore(storedToken, storedRefreshToken);
        if (sess.isexpired(Date.now() / 1000)) {
          // Try to refresh
          try {
            sess = await client.sessionRefresh(sess);
            localStorage.setItem('nakama_token', sess.token);
            localStorage.setItem('nakama_refresh_token', sess.refresh_token);
          } catch {
            sess = null;
          }
        }
      }

      if (!sess) {
        // Create device ID for anonymous auth
        let deviceId = localStorage.getItem('nakama_device_id');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('nakama_device_id', deviceId);
        }

        sess = await client.authenticateDevice(deviceId, true, username || `Player_${deviceId.slice(0, 6)}`);
        localStorage.setItem('nakama_token', sess.token);
        localStorage.setItem('nakama_refresh_token', sess.refresh_token);
      }

      // If username provided and different from stored, update account
      if (username && sess.username !== username) {
        await client.updateAccount(sess, { username });
      }

      // Create socket connection
      const sock = client.createSocket(NAKAMA_USE_SSL, false);
      await sock.connect(sess, true);

      setSession(sess);
      setSocket(sock);

      return { session: sess, socket: sock, client };
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to server';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [getClient]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect(true);
    }
    setSession(null);
    setSocket(null);
  }, [socket]);

  const sendRpc = useCallback(async (rpcId: string, payload: object) => {
    if (!session || !clientRef.current) throw new Error('Not connected');
    const result = await clientRef.current.rpc(session, rpcId, payload);
    if (!result.payload) return null;
    return typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
  }, [session]);

  return {
    session,
    socket,
    client: clientRef.current,
    isConnecting,
    error,
    authenticate,
    disconnect,
    sendRpc,
  };
}
