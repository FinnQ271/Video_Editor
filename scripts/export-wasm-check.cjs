// Integration checks against the same single-thread FFmpeg core used by the app.
// Downloads only the pinned core into ignored tools/export-check/.
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')

async function main() {
  const directory = path.resolve('tools/export-check')
  await fs.mkdir(directory, {recursive:true})
  for (const file of ['ffmpeg-core.js','ffmpeg-core.wasm']) {
    const target=path.join(directory,file)
    try { await fs.access(target) } catch {
      const response=await fetch(`https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/${file}`)
      if(!response.ok) throw new Error(`Core download failed: ${response.status}`)
      await fs.writeFile(target,Buffer.from(await response.arrayBuffer()))
    }
  }
  // The UMD build is CommonJS; keep its wasm beside it.
  await fs.copyFile(path.join(directory,'ffmpeg-core.js'),path.join(directory,'ffmpeg-core.cjs'))
  global.self={location:{href:'file:///ffmpeg-core.js'}}
  const core=await require(path.join(directory,'ffmpeg-core.cjs'))({wasmBinary:await fs.readFile(path.join(directory,'ffmpeg-core.wasm'))})
  const listeners=new Map()
  const logs=[]
  core.setLogger(event=>{logs.push(event.message);listeners.get('log')?.forEach(fn=>fn(event))})
  const run=args=>{core.exec(...args); const code=core.ret; core.reset(); return code}
  const ffmpeg={
    on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},
    off:(event,fn)=>listeners.get(event)?.delete(fn),
    writeFile:async(name,data)=>core.FS.writeFile(name,data),
    readFile:async name=>core.FS.readFile(name),
    deleteFile:async name=>core.FS.unlink(name),
    exec:async args=>run(args),
  }
  assert.equal(run(['-f','lavfi','-i','color=c=blue:s=160x90:r=24:d=12','-f','lavfi','-i','aevalsrc=0.125*sin(2*PI*if(lt(t\\,10)\\,440\\,660)*t):d=12','-c:v','libx264','-c:a','aac','-y','source.mp4']),0)
  assert.equal(run(['-f','lavfi','-i','sine=frequency=880:duration=4','-c:a','pcm_s16le','-y','music.wav']),0)
  assert.equal(run(['-f','lavfi','-i','color=c=black:s=160x90:r=24:d=2','-c:v','libx264','-y','silent.mp4']),0)
  const sources={video:core.FS.readFile('source.mp4'),music:core.FS.readFile('music.wav'),silent:core.FS.readFile('silent.mp4')}
  const moduleObject={exports:{}}
  const source=(await fs.readFile('src/services/export.ts','utf8')).replaceAll('import.meta.env.DEV','false')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports',compiled)(name=>name==='./ffmpeg'?{getFFmpeg:async()=>ffmpeg,fetchFile:async src=>sources[src]}:{hasSquareBounds:()=>false},moduleObject,moduleObject.exports)
  const clip={id:'v',name:'source.mp4',src:'video',sourceStart:0,sourceEnd:2,timelineStart:0,duration:2}
  const music={id:'m',name:'music.wav',src:'music',sourceStart:0,sourceEnd:2,timelineStart:.5,duration:2}
  const cases=[
    ['embedded',{},[]],['mix',{},[music]],['mute',{muted:true},[music]],['volume',{volume:.5},[]],
    ['trim',{sourceStart:10,sourceEnd:12},[]],['delay',{},[{...music,timelineStart:5}]],
    ['two tracks',{},[music,{...music,id:'m2',timelineStart:0}]],['fades',{fadeIn:.5,fadeOut:.5},[]],
    ['speed',{speed:2,sourceEnd:4},[]],['WebM',{},[]],['silent',{src:'silent'},[]],['transition',{},[]],
  ]
  for(const [label,updates,audio] of cases) {
    const project={name:label,duration:label==='delay'?7:3,canvas:{width:160,height:90},tracks:[{type:'video',clips:[{...clip,...updates}],muted:false},...audio.map(c=>({type:'audio',muted:false,clips:[c]}))],transitions:[],visualElements:[]}
    if(label==='transition') {
      project.tracks[0].clips.push({...clip,id:'v2',timelineStart:2,duration:1,sourceEnd:1})
      project.transitions.push({fromClipId:'v',toClipId:'v2',type:'fade',duration:.5})
    }
    logs.length=0
    const result=await moduleObject.exports.exportProject(project,{resolution:'480p',fps:24,format:label==='WebM'?'webm':'mp4'})
    assert.ok(result.blob.size>100)
    if(label==='silent') assert.ok(!logs.some(line=>/Stream #.*Audio:/.test(line)))
    else {
      core.FS.writeFile('check.bin',new Uint8Array(await result.blob.arrayBuffer()))
      assert.equal(run(['-i','check.bin','-map','0:a:0','-ac','1','-ar','8000','-f','f32le','-y','samples.raw']),0)
      const bytes=core.FS.readFile('samples.raw'), samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4)
      assert.ok(Math.abs(samples.length/8000-project.duration)<.15,`${label}: audio duration`)
      const energy=(start,end,frequency)=>{
        let real=0,imag=0,power=0,n=0
        for(let i=Math.round(start*8000);i<Math.min(samples.length,Math.round(end*8000));i++) {
          const value=samples[i]; power+=value*value; real+=value*Math.cos(2*Math.PI*frequency*i/8000); imag+=value*Math.sin(2*Math.PI*frequency*i/8000);n++
        }
        return frequency ? Math.hypot(real,imag)/n : Math.sqrt(power/n)
      }
      if(label==='mute') {assert.ok(energy(1,1.5,880)>.02);assert.ok(energy(1,1.5,440)<.005)}
      else if(label==='trim') assert.ok(energy(.5,1,660)>.02)
      else assert.ok(energy(.5,1,440)>.015,`${label}: original tone missing`)
      if(label==='mix'||label==='two tracks') assert.ok(energy(1,1.5,880)>.02)
      if(label==='delay') {assert.ok(energy(3,4,0)<.001);assert.ok(energy(5.5,6,880)>.02)}
      if(label==='volume') assert.ok(energy(.5,1,440)<.04)
      if(label==='fades') {assert.ok(energy(.02,.1,0)<energy(.7,.9,0)*.5);assert.ok(energy(1.9,1.98,0)<energy(.7,.9,0)*.5)}
      core.FS.unlink('check.bin');core.FS.unlink('samples.raw')
    }
    console.log(`PASS ${label}: streams, decoded audio content and duration verified`)
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
