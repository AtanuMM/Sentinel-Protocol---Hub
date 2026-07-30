import { useState, useCallback } from 'react';

/** @returns {{ connections: [], isLoading: boolean, refresh: () => void }} */
export function useFTPConnections() {
  const [connections] = useState([]);
  const refresh = useCallback(() => {
    // TODO: wire to FTP connections API
    console.log('[AddChannels] refresh FTP connections');
  }, []);

  return { connections, isLoading: false, refresh };
}

/** @returns {{ connections: [], isLoading: boolean, refresh: () => void }} */
export function useEmailSourceConnections() {
  const [connections] = useState([]);
  const refresh = useCallback(() => {
    // TODO: wire to email sources API (requires vault key)
    console.log('[AddChannels] refresh email source connections');
  }, []);

  return { connections, isLoading: false, refresh };
}
