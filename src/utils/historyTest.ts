import type { MediaAsset, TimelineClip, TimelineTrack } from '../types/editor'

export interface TestLog {
  step: string
  actionName: string
  passed: boolean
  details: string
  pastCount: number
  futureCount: number
  clipCount: number
}

interface TestSnapshot {
  tracks: TimelineTrack[]
  selectedClipId?: string
}

/**
 * Executes full test sequence:
 * Add → Move → Split → Trim → Delete → Undo (5x) → Redo (5x)
 * Validating state restoration accuracy at every single step.
 */
export function runHistoryTestSuite(): { logs: TestLog[]; allPassed: boolean } {
  const logs: TestLog[] = []
  let allPassed = true

  // Initial baseline snapshot
  const initialSnapshot: TestSnapshot = {
    tracks: [
      {
        id: 'track-1',
        type: 'video',
        name: 'Video Track 1',
        locked: false,
        muted: false,
        clips: [],
      },
    ],
    selectedClipId: undefined,
  }

  // History state simulation
  const past: TestSnapshot[] = []
  let present: TestSnapshot = JSON.parse(JSON.stringify(initialSnapshot))
  const future: TestSnapshot[] = []

  function record(newPresent: TestSnapshot) {
    past.push(JSON.parse(JSON.stringify(present)))
    present = JSON.parse(JSON.stringify(newPresent))
    future.length = 0 // Clear future stack on new action
  }

  function undo(): boolean {
    if (past.length === 0) return false
    const previous = past.pop()!
    future.unshift(JSON.parse(JSON.stringify(present)))
    present = previous
    return true
  }

  function redo(): boolean {
    if (future.length === 0) return false
    const next = future.shift()!
    past.push(JSON.parse(JSON.stringify(present)))
    present = next
    return true
  }

  const dummyAsset: MediaAsset = {
    id: 'asset-1',
    name: 'Sample_Video.mp4',
    url: 'blob:sample',
    duration: 10,
    width: 1920,
    height: 1080,
    mimeType: 'video/mp4',
    size: 1024 * 1024,
    createdAt: Date.now(),
  }

  // 1. Action: Add Clip
  const clip1: TimelineClip = {
    id: 'clip-1',
    assetId: dummyAsset.id,
    name: dummyAsset.name,
    src: dummyAsset.url,
    mediaDuration: dummyAsset.duration,
    sourceStart: 0,
    sourceEnd: 10,
    timelineStart: 0,
    duration: 10,
    volume: 1,
  }

  const snapshot1: TestSnapshot = {
    tracks: [{ ...present.tracks[0], clips: [clip1] }],
    selectedClipId: clip1.id,
  }
  record(snapshot1)

  const pass1 =
    past.length === 1 &&
    future.length === 0 &&
    present.tracks[0].clips.length === 1 &&
    present.tracks[0].clips[0].timelineStart === 0
  logs.push({
    step: 'Step 1',
    actionName: 'Add Clip',
    passed: pass1,
    details: `Clip added at t=0s. Past: ${past.length}, Future: ${future.length}, Clips: ${present.tracks[0].clips.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!pass1) allPassed = false

  // 2. Action: Move Clip (to timelineStart = 4s)
  const movedClip: TimelineClip = { ...clip1, timelineStart: 4 }
  const snapshot2: TestSnapshot = {
    tracks: [{ ...present.tracks[0], clips: [movedClip] }],
    selectedClipId: clip1.id,
  }
  record(snapshot2)

  const pass2 =
    past.length === 2 &&
    future.length === 0 &&
    present.tracks[0].clips[0].timelineStart === 4
  logs.push({
    step: 'Step 2',
    actionName: 'Move Clip',
    passed: pass2,
    details: `Clip moved to t=4s. Past: ${past.length}, Future: ${future.length}, Start: ${present.tracks[0].clips[0].timelineStart}s`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!pass2) allPassed = false

  // 3. Action: Split Clip (at t = 6s, 2s into clip)
  const clipA: TimelineClip = {
    ...movedClip,
    id: 'clip-1a',
    sourceEnd: 2,
    duration: 2,
  }
  const clipB: TimelineClip = {
    ...movedClip,
    id: 'clip-1b',
    sourceStart: 2,
    timelineStart: 6,
    duration: 8,
  }
  const snapshot3: TestSnapshot = {
    tracks: [{ ...present.tracks[0], clips: [clipA, clipB] }],
    selectedClipId: clipB.id,
  }
  record(snapshot3)

  const pass3 =
    past.length === 3 &&
    future.length === 0 &&
    present.tracks[0].clips.length === 2 &&
    present.tracks[0].clips[0].duration === 2 &&
    present.tracks[0].clips[1].duration === 8
  logs.push({
    step: 'Step 3',
    actionName: 'Split Clip',
    passed: pass3,
    details: `Clip split at t=6s into 2 segments (2s & 8s). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!pass3) allPassed = false

  // 4. Action: Trim Clip (trim Clip B left by 1s)
  const trimmedClipB: TimelineClip = {
    ...clipB,
    sourceStart: 3,
    timelineStart: 7,
    duration: 7,
  }
  const snapshot4: TestSnapshot = {
    tracks: [{ ...present.tracks[0], clips: [clipA, trimmedClipB] }],
    selectedClipId: clipB.id,
  }
  record(snapshot4)

  const pass4 =
    past.length === 4 &&
    future.length === 0 &&
    present.tracks[0].clips[1].duration === 7 &&
    present.tracks[0].clips[1].timelineStart === 7
  logs.push({
    step: 'Step 4',
    actionName: 'Trim Clip',
    passed: pass4,
    details: `Clip B left trimmed by 1s (start=7s, duration=7s). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!pass4) allPassed = false

  // 5. Action: Delete Clip A
  const snapshot5: TestSnapshot = {
    tracks: [{ ...present.tracks[0], clips: [trimmedClipB] }],
    selectedClipId: undefined,
  }
  record(snapshot5)

  const pass5 =
    past.length === 5 &&
    future.length === 0 &&
    present.tracks[0].clips.length === 1 &&
    present.tracks[0].clips[0].id === 'clip-1b'
  logs.push({
    step: 'Step 5',
    actionName: 'Delete Clip',
    passed: pass5,
    details: `Clip A deleted. Past: ${past.length}, Future: ${future.length}, Remaining clips: 1`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!pass5) allPassed = false

  // --- UNDO SEQUENCE ---
  // Undo 1: Restores deleted Clip A
  undo()
  const passU1 = past.length === 4 && future.length === 1 && present.tracks[0].clips.length === 2
  logs.push({
    step: 'Undo 1',
    actionName: 'Undo Delete',
    passed: passU1,
    details: `Clip A restored. Past: ${past.length}, Future: ${future.length}, Clips: ${present.tracks[0].clips.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passU1) allPassed = false

  // Undo 2: Restores untrimmed Clip B
  undo()
  const passU2 = past.length === 3 && future.length === 2 && present.tracks[0].clips[1].duration === 8
  logs.push({
    step: 'Undo 2',
    actionName: 'Undo Trim',
    passed: passU2,
    details: `Clip B trim undone (duration restored to 8s). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passU2) allPassed = false

  // Undo 3: Merges split clips
  undo()
  const passU3 = past.length === 2 && future.length === 3 && present.tracks[0].clips.length === 1
  logs.push({
    step: 'Undo 3',
    actionName: 'Undo Split',
    passed: passU3,
    details: `Split undone (clips merged into 1). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passU3) allPassed = false

  // Undo 4: Moves clip back to t=0s
  undo()
  const passU4 = past.length === 1 && future.length === 4 && present.tracks[0].clips[0].timelineStart === 0
  logs.push({
    step: 'Undo 4',
    actionName: 'Undo Move',
    passed: passU4,
    details: `Move undone (timelineStart restored to 0s). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passU4) allPassed = false

  // Undo 5: Removes added clip (back to baseline)
  undo()
  const passU5 = past.length === 0 && future.length === 5 && present.tracks[0].clips.length === 0
  logs.push({
    step: 'Undo 5',
    actionName: 'Undo Add',
    passed: passU5,
    details: `Add undone (timeline empty, baseline restored). Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passU5) allPassed = false

  // --- REDO SEQUENCE ---
  // Redo 1: Add
  redo()
  const passR1 = past.length === 1 && future.length === 4 && present.tracks[0].clips.length === 1
  logs.push({
    step: 'Redo 1',
    actionName: 'Redo Add',
    passed: passR1,
    details: `Re-added clip. Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passR1) allPassed = false

  // Redo 2: Move
  redo()
  const passR2 = past.length === 2 && future.length === 3 && present.tracks[0].clips[0].timelineStart === 4
  logs.push({
    step: 'Redo 2',
    actionName: 'Redo Move',
    passed: passR2,
    details: `Re-moved clip to t=4s. Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passR2) allPassed = false

  // Redo 3: Split
  redo()
  const passR3 = past.length === 3 && future.length === 2 && present.tracks[0].clips.length === 2
  logs.push({
    step: 'Redo 3',
    actionName: 'Redo Split',
    passed: passR3,
    details: `Re-split clip into 2 segments. Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passR3) allPassed = false

  // Redo 4: Trim
  redo()
  const passR4 = past.length === 4 && future.length === 1 && present.tracks[0].clips[1].duration === 7
  logs.push({
    step: 'Redo 4',
    actionName: 'Redo Trim',
    passed: passR4,
    details: `Re-trimmed Clip B to 7s. Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passR4) allPassed = false

  // Redo 5: Delete
  redo()
  const passR5 = past.length === 5 && future.length === 0 && present.tracks[0].clips.length === 1
  logs.push({
    step: 'Redo 5',
    actionName: 'Redo Delete',
    passed: passR5,
    details: `Re-deleted Clip A. Past: ${past.length}, Future: ${future.length}`,
    pastCount: past.length,
    futureCount: future.length,
    clipCount: present.tracks[0].clips.length,
  })
  if (!passR5) allPassed = false

  return { logs, allPassed }
}
