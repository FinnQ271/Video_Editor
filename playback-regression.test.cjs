const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const output = ts.transpileModule(fs.readFileSync('src/utils/playback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const mod = {exports:{}}
new Function('require','module','exports',output)(() => ({evaluateProperties:(_keys,_time,defaults)=>defaults}),mod,mod.exports)
const {PlaybackClock,syncPlaybackVideo}=mod.exports
const clip={id:'a',src:'video',sourceStart:0,sourceEnd:10,speed:1,volume:1}
function video() {
 let time=0
 return {readyState:2,seeking:false,paused:true,playbackRate:1,volume:1,muted:false,seeks:0,plays:0,pauses:0,
 get currentTime(){return time},set currentTime(value){time=value;this.seeks++},
 advance(value){time=value},
 play(){this.plays++;this.paused=false;return Promise.resolve()},
 pause(){this.pauses++;this.paused=true}}
}
test('clock keeps real elapsed time through delayed React renders and seeks',()=>{
 const clock=new PlaybackClock()
 clock.reset(2,1000)
 assert.equal(clock.read(2000,10),3)
 assert.equal(clock.read(3500,10),4.5)
 clock.reset(7,4000)
 assert.equal(clock.read(4500,10),7.5)
 assert.equal(clock.read(9000,10),10)
})
test('normal playback does not repeatedly seek or call play',async()=>{
 const v=video()
 syncPlaybackVideo(v,clip,0,true,1,false)
 await Promise.resolve()
 for(let frame=1;frame<120;frame++){
  const target=frame/30
  v.advance(target+.04)
  syncPlaybackVideo(v,clip,target,true,1,false)
 }
 assert.equal(v.seeks,0)
 assert.equal(v.plays,1)
})
test('scrubbing, clip changes, speed and pause remain synchronized',()=>{
 const v=video()
 syncPlaybackVideo(v,clip,2,false,.5,true)
 assert.equal(v.currentTime,2)
 assert.equal(v.volume,.5)
 assert.equal(v.muted,true)
 syncPlaybackVideo(v,{...clip,id:'b',speed:2},4,true,1,false)
 assert.equal(v.currentTime,4)
 assert.equal(v.playbackRate,2)
 syncPlaybackVideo(v,clip,4,false,1,false)
 assert.equal(v.paused,true)
})
test('significant drift corrects once and pending seeks are not overwritten',()=>{
 const v=video()
 syncPlaybackVideo(v,clip,0,true,1,false)
 syncPlaybackVideo(v,clip,1,true,1,false)
 assert.equal(v.seeks,1)
 v.seeking=true
 syncPlaybackVideo(v,clip,2,true,1,false)
 assert.equal(v.seeks,1)
})
test('outgoing transition holds final frame without play/seek loops',()=>{
 const v=video()
 for(let i=0;i<30;i++)syncPlaybackVideo(v,clip,9.98,true,1,false,true)
 assert.equal(v.seeks,1)
 assert.equal(v.plays,0)
 assert.equal(v.paused,true)
})
test('unloaded source waits for metadata',()=>{
 const v=video();v.readyState=0
 syncPlaybackVideo(v,clip,2,true,1,false)
 assert.equal(v.seeks,0)
 assert.equal(v.plays,0)
})
