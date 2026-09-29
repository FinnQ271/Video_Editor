import type { IncomingMessage, ServerResponse } from 'node:http'
import { mediaImportHandler } from '../../server/mediaImport.ts'

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await mediaImportHandler(req, res, { localOnly: false, body: req.body })
}
