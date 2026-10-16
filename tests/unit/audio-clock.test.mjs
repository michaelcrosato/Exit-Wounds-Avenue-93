import test from 'node:test';
import assert from 'node:assert/strict';
import {CityAudio} from '../../src/systems/audio.js';

test('footstep cadence resumes immediately when a new run rewinds simulation time',()=>{
  const audio=new CityAudio(),played=[];audio.play=name=>played.push(name);
  audio.footstep(100,2,'asphalt');
  audio.footstep(0,2,'concrete');
  audio.footstep(.5,2,'wood');
  assert.deepEqual(played,['step','step','step']);
});
