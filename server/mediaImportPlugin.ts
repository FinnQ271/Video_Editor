import type { Plugin } from 'vite'
import { mediaImportHandler } from './mediaImport.ts'

export function mediaImportPlugin(): Plugin {
  return {
    name: 'local-video-url-import',
    configureServer(server) { server.middlewares.use('/api/media/import', (req,res) => { void mediaImportHandler(req,res) }) },
    configurePreviewServer(server) { server.middlewares.use('/api/media/import', (req,res) => { void mediaImportHandler(req,res) }) },
  }
}
