import { useReducer, useEffect, useRef, useCallback } from 'react';
import { appReducer } from './reducer';
import { loadState, saveState } from './persistence';
import { AppState } from './state';
import { AppAction } from './actions';
import { syncEngine } from '../sync/engine';

export interface UseAppStoreReturn {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const storageKey = syncEngine.stateStorageKey;

/**
 * Custom React hook that initializes state using pure loadState()
 * and automatically persists state changes to localStorage.
 * - Other tabs of the same browser are kept in sync through the `storage` event.
 * - When a sync server is available (operator opened with ?admin=KEY, or a
 *   judge phone), every user action is also handed to the sync engine.
 */
export function useAppStore(): UseAppStoreReturn {
  const [state, rawDispatch] = useReducer(appReducer, storageKey, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const skipNextSaveRef = useRef(false);

  // Synchronize state changes to localStorage
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveState(state, storageKey);
  }, [state]);

  // Pick up changes written by other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey || e.newValue === null) return;
      skipNextSaveRef.current = true;
      rawDispatch({ type: 'IMPORT_BACKUP', payload: { state: loadState(storageKey), fromSync: true } });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Start the sync engine (no-op in standalone mode)
  useEffect(() => {
    syncEngine.start(
      () => stateRef.current,
      (next) => {
        // Apply immediately so a push right after sees the new state
        stateRef.current = next;
        rawDispatch({ type: 'IMPORT_BACKUP', payload: { state: next, fromSync: true } });
      }
    );
  }, []);

  const dispatch = useCallback((action: AppAction) => {
    rawDispatch(action);
    // Let the reducer run first so a push sends the updated state
    stateRef.current = appReducer(stateRef.current, action);
    syncEngine.onLocalAction(action);
  }, []);

  return { state, dispatch };
}
