const paths = {
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  undo: 'M9 4L4 9l5 5 M4 9h10a6 6 0 0 1 0 12',
  redo: 'M15 4l5 5-5 5 M20 9H10a6 6 0 0 0 0 12',
  audio: 'M9 18V5l12-2v13 M9 8l12-2 M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3 M21 16a3 3 0 1 1-3-3c2 0 3 1 3 3',
  effects: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  transition: 'M3 5h7v14H3z M14 5h7v14h-7z M8 12h8 M13 9l3 3-3 3',
  play: 'M8 4l12 8-12 8z',
  pause: 'M8 4v16 M16 4v16',
  volume: 'M3 9h4l5-5v16l-5-5H3z M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14',
  mute: 'M3 9h4l5-5v16l-5-5H3z M16 9l6 6 M22 9l-6 6',
  fullscreen: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
  close: 'M6 6l12 12 M18 6L6 18',
  split: 'M12 3v18 M4 7l5 5-5 5 M20 7l-5 5 5 5',
  duplicate: 'M8 8h13v13H8z M16 8V3H3v13h5',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  chevron: 'M9 5l7 7-7 7',

  film: 'M4 3h16v18H4z M8 3v18 M16 3v18 M4 8h4 M4 16h4 M16 8h4 M16 16h4',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  text: 'M4 5V3h16v2 M12 3v18 M8 21h8',
  image: 'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01',
  sliders: 'M4 3v7 M4 14v7 M12 3v12 M12 19v2 M20 3v3 M20 10v11 M1 10h6 M9 15h6 M17 6h6',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  monitor: 'M3 3h18v14H3z M12 17v4 M8 21h8',
} as const

export default function StudioIcon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
