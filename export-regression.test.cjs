const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function setup({ code = 0, empty = false, writeFails = false, silentVideo = false, missingOutputAudio = false } = {}) {
  const listeners = new Map(), deleted = [], calls = []
  let reads = 0
  const ffmpeg = {
    on: (event, fn) => { if (!listeners.has(event)) listeners.set(event,new Set()); listeners.get(event).add(fn) },
    off: (event, fn) => { listeners.get(event)?.delete(fn); if(!listeners.get(event)?.size) listeners.delete(event) },
    writeFile: async () => { if (writeFails) throw new Error('Input unavailable') },
    deleteFile: async name => { deleted.push(name) },
    exec: async args => {
      const emit=(event,value)=>listeners.get(event)?.forEach(fn=>fn(value))
      if(args.length===2) {
        emit('log',{message:'Stream #0:0: Video: h264'})
        if (!(args[1].startsWith('video_') && silentVideo) && !(args[1].startsWith('export.') && missingOutputAudio)) emit('log',{message:'Stream #0:1: Audio: aac'})
        return 1
      }
      calls.push(args); emit('log',{message:'Invalid input for encoder'}); emit('progress',{progress:1}); return code
    },
    readFile: async () => { reads++; return new Uint8Array(empty ? [] : [1,2,3]) },
  }
  const output = ts.transpileModule(fs.readFileSync('src/services/export.ts','utf8').replaceAll('import.meta.env.DEV','false'), {
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

const withMusic = (updates = {}) => ({...project, duration:12, tracks:[
 {...project.tracks[0],clips:[{...project.tracks[0].clips[0],...updates}]},
 {type:'audio',muted:false,clips:[{id:'music',src:'blob:music',name:'music.mp3',sourceStart:0,sourceEnd:4,duration:4,timelineStart:5}]}
]})
const graph = service => service.calls[0][service.calls[0].indexOf('-filter_complex')+1]

test('embedded audio alone is mapped and encoded AAC alongside H264', async () => {
 const s=setup(); await s.exportProject(project,options)
 assert.match(graph(s), /\[0:a:0\]/)
 assert.ok(s.calls[0].includes('aac')); assert.ok(s.calls[0].includes('libx264'))
 assert.ok(s.calls[0].includes('[aout]'))
})
test('video audio and music mix without normalization at timeline positions', async () => {
 const s=setup(); await s.exportProject(withMusic(),options)
 assert.match(graph(s),/\[0:a:0\]/); assert.match(graph(s),/\[1:a:0\]/)
 assert.match(graph(s),/adelay=5000:all=1/)
 assert.match(graph(s),/amix=inputs=2:duration=longest:normalize=0/)
 assert.match(graph(s),/apad,atrim=duration=12/)
})
test('muted clip or zero volume excludes original sound and preserves music', async () => {
 for(const update of [{muted:true},{volume:0}]) {
  const s=setup(); await s.exportProject(withMusic(update),options)
  assert.doesNotMatch(graph(s),/\[0:a:0\]/); assert.match(graph(s),/\[1:a:0\]/)
 }
})
test('50 percent volume, source trim and speed are applied together', async () => {
 const s=setup(); await s.exportProject(withMusic({volume:.5,sourceStart:10,sourceEnd:20,duration:5,speed:2}),options)
 assert.deepEqual(s.calls[0].slice(0,6),['-ss','10','-t','10','-i','video_0.mp4'])
 assert.match(graph(s),/atempo=2,atrim=duration=5,volume=0.5/)
 assert.match(graph(s),/setpts=\(PTS-STARTPTS\)\/2/)
})
test('two independent audio tracks join video audio in the mix', async () => {
 const p=withMusic(); p.tracks.push({...p.tracks[1],clips:[{...p.tracks[1].clips[0],id:'voice'}]})
 const s=setup(); await s.exportProject(p,options)
 assert.match(graph(s),/amix=inputs=3/)
})
test('fade and chained tempo survive export', async () => {
 const s=setup(); await s.exportProject(withMusic({duration:4,fadeIn:1,fadeOut:2,speed:4}),options)
 assert.match(graph(s),/atempo=2,atempo=2/)
 assert.match(graph(s),/afade=t=in:d=1,afade=t=out:st=2:d=2/)
})
test('WebM encodes VP9 and Opus', async () => {
 const s=setup(); await s.exportProject(project,{...options,format:'webm'})
 assert.ok(s.calls[0].includes('libvpx-vp9')); assert.ok(s.calls[0].includes('libopus')); assert.ok(!s.calls[0].includes('aac'))
})
test('silent source exports video without an invented audio stream', async () => {
 const s=setup({silentVideo:true}); await s.exportProject(project,options)
 assert.doesNotMatch(graph(s),/amix|\[0:a/); assert.ok(!s.calls[0].includes('[aout]'))
})
test('missing output audio fails validation and still cleans up', async () => {
 const s=setup({missingOutputAudio:true})
 await assert.rejects(s.exportProject(project,options),/missing a required/)
 assert.ok(s.deleted.includes('export.mp4')); assert.equal(s.listeners.size,0)
})
test('track mute keeps video visible and excludes its audio', async () => {
 const p=withMusic(); p.tracks[0].muted=true
 const s=setup(); await s.exportProject(p,options)
 assert.match(graph(s),/\[0:v\]/); assert.doesNotMatch(graph(s),/\[0:a:0\]/)
})

test('volume keyframes retain audio when the base volume is zero', async () => {
 const s=setup(); await s.exportProject(withMusic({volume:0,keyframeProperties:[{property:'volume',keyframes:[{time:0,value:0,easing:'linear'},{time:1,value:1,easing:'ease-in'}]}]}),options)
 assert.match(graph(s),/\[0:a:0\]/);assert.match(graph(s),/pow\(/)
})
test('slow speed chains atempo and gaps preserve timeline positions', async () => {
 const s=setup(); await s.exportProject(withMusic({speed:.125,timelineStart:2}),options)
 assert.match(graph(s),/atempo=0.5,atempo=0.5,atempo=0.5/)
 assert.match(graph(s),/setpts=PTS\+2\/TB/)
 assert.match(graph(s),/adelay=2000:all=1/)
})
