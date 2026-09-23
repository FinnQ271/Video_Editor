import { useCallback, useState } from 'react'

export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

/**
 * Safely deep clone any value to prevent mutable reference side effects.
 * Uses structuredClone if available, otherwise falls back to JSON serialization.
 */
function safeDeepClone<T>(val: T): T {
  if (val === undefined || val === null) return val
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(val)
    }
  } catch {
    // Fallback to JSON clone if structuredClone fails (e.g. DOM objects)
  }
  return JSON.parse(JSON.stringify(val))
}

export function useHistory<T>(initialPresent: T) {
  const [history, setHistory] = useState<HistoryState<T>>(() => ({
    past: [],
    present: safeDeepClone(initialPresent),
    future: [],
  }))

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  /**
   * Record a new action:
   * - Saves deep clone of current present state to past stack
   * - Sets present to deep clone of newPresent
   * - Clears future stack completely
   */
  const record = useCallback((newPresent: T) => {
    setHistory((curr) => {
      const merged = (curr.present && newPresent && typeof curr.present === 'object' && typeof newPresent === 'object') ? { ...curr.present, ...newPresent } as T : newPresent
      const nextSnapshot = safeDeepClone(merged)
      const currentSnapshot = safeDeepClone(curr.present)

      // Limit history stack size to 50 entries to prevent memory bloat
      const newPast = [...curr.past, currentSnapshot].slice(-50)

      return {
        past: newPast,
        present: nextSnapshot,
        future: [], // Clear future stack on new action as required
      }
    })
  }, [])

  /**
   * Update present state directly without recording to past or clearing future.
   * Useful for transient live updates during drag operations or selection updates.
   */
  const setPresent = useCallback((newPresent: T) => {
    setHistory((curr) => ({
      ...curr,
      present: safeDeepClone(newPresent),
    }))
  }, [])

  /**
   * Undo: Pops the latest snapshot from past into present, and pushes current present to future.
   */
  const undo = useCallback(() => {
    setHistory((curr) => {
      if (curr.past.length === 0) return curr
      const previous = curr.past[curr.past.length - 1]
      const newPast = curr.past.slice(0, curr.past.length - 1)

      return {
        past: newPast,
        present: previous,
        future: [safeDeepClone(curr.present), ...curr.future],
      }
    })
  }, [])

  /**
   * Redo: Pops the first snapshot from future into present, and pushes current present to past.
   */
  const redo = useCallback(() => {
    setHistory((curr) => {
      if (curr.future.length === 0) return curr
      const next = curr.future[0]
      const newFuture = curr.future.slice(1)

      return {
        past: [...curr.past, safeDeepClone(curr.present)],
        present: next,
        future: newFuture,
      }
    })
  }, [])

  /**
   * Reset history to a new initial state, clearing past and future stacks.
   */
  const resetHistory = useCallback((newInitialPresent: T) => {
    setHistory({
      past: [],
      present: safeDeepClone(newInitialPresent),
      future: [],
    })
  }, [])

  return {
    state: history.present,
    present: history.present,
    past: history.past,
    future: history.future,
    canUndo,
    canRedo,
    record,
    setPresent,
    undo,
    redo,
    resetHistory,
  }
}

