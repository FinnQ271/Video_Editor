import { useContext } from 'react'
import { EditorContext } from '../store/EditorContext'
export function useEditor() { const editor = useContext(EditorContext); if (!editor) throw new Error('useEditor must be used inside EditorProvider'); return editor }
