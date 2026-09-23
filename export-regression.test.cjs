const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function setup({ code = 0, empty = false, writeFails = false } = {}) {
  const listeners = new Map(), deleted = [], calls = []
  let reads = 0
  const ffmpeg = {
    on: (event, fn) => listeners.set(event, fn),
    off: (event) => listeners.delete(event),
    writeFile: async () => { if (writeFails) throw new Error('Input unavailable') },
    deleteFile: async name => { deleted.push(name) },
    exec: async args => { calls.push(args); listeners.get('log')?.({message:'Invalid input for encoder'}); listeners.get('progress')?.({progress:1}); return code },
    readFile: async () => { reads++; return new Uint8Array(empty ? [] : [1,2,3]) },
  }
  const output = ts.transpileModule(fs.readFileSync('src/services/export.ts','utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText
  const mod = {exports:{}}
  new Function('require','module','exports',output)(name => {
    if(name === './ffmpeg') return {getFFmpeg:async()=>ffmpeg,fetchFile:async()=>new Uint8Array([1])}
    if(name === '../utils/visualGeometry') return {hasSquareBounds:()=>false}
    throw new Error(name)
  },mod,mod.exports)
  return {...mod.exports,listeners,deleted,calls,get reads(){return reads}}
}
const project = {name:'test',duration:2,canvas:{width:1920,height:1080},tracks:[
  {type:'video',muted:false,clips:[{id:'one',src:'blob:video',name:'video.mp4',sourceStart:0,duration:2,timelineStart:0}]}
],transitions:[],visualElements:[]}
const options = {resolution:'1080p',fps:24,format:'mp4'}

test('FPS options use numeric values', () => {
 const source=fs.readFileSync('src/components/VideoEditor/ExportModal.tsx','utf8')
 assert.match(source, /<option key=\{x\} value=\{x\}>\{x\} FPS<\/option>/)
})
test('24, 30, 60 FPS export successfully with finite estimates and cleanup', async () => {
 for(const fps of [24,30,60]) {
  const service=setup(), progress=[]
  assert.ok(Number.isFinite(service.estimateExportSize(project,{...options,fps})))
  const result=await service.exportProject(project,{...options,fps},p=>progress.push(p))
  assert.equal(result.blob.size,3)
  const args=service.calls[0]
  assert.equal(args[args.indexOf('-r')+1],String(fps))
  assert.equal(progress.at(-1).percent,100)
  assert.ok(progress.slice(0,-1).every(p=>p.percent<100))
  assert.equal(service.listeners.size,0)
  assert.ok(service.deleted.includes('export.mp4'))
 }
})
test('invalid FPS fails before encoding and estimate never becomes NaN', async () => {
 const service=setup()
 await assert.rejects(service.exportProject(project,{...options,fps:NaN}),/Invalid frame rate/)
 assert.equal(service.calls.length,0)
 assert.equal(service.estimateExportSize(project,{...options,fps:NaN}),0)
})
test('FFmpeg failure reports logs without reading missing output or showing 100%', async () => {
 const service=setup({code:1}), progress=[]
 await assert.rejects(service.exportProject(project,options,p=>progress.push(p)),/FFmpeg code 1.*\nInvalid input/)
 assert.equal(service.reads,0)
 assert.ok(progress.every(p=>p.percent<100))
 assert.equal(service.listeners.size,0)
 assert.ok(service.deleted.includes('video_0.mp4'))
})
test('empty output and failed uploads clean up resources', async () => {
 for(const config of [{empty:true},{writeFails:true}]) {
  const service=setup(config)
  await assert.rejects(service.exportProject(project,options),config.empty?/empty video/:/Input unavailable/)
  assert.equal(service.listeners.size,0)
  assert.ok(service.deleted.includes('video_0.mp4'))
 }
})
