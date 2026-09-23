import VideoEditor from '../components/VideoEditor/VideoEditor'
import { EditorProvider } from '../store/EditorContext'
import '../App.css'
import '../studio.css'

export default function Home() {
  return (
    <EditorProvider>
      <VideoEditor />
    </EditorProvider>
  )
}

