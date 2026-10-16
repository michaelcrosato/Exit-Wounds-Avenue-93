import test from 'node:test';
import assert from 'node:assert/strict';
import {SettingsStore,SETTINGS_KEY} from '../../src/game/save.js';

function memoryStorage(){
  const data=new Map();
  return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}

test('settings storage rejects malformed camera, audio and menu values before boot uses them',()=>{
  const storage=memoryStorage(),store=new SettingsStore(storage);
  for(const field of [
    {sensitivity:'not-a-number'},
    {masterVolume:'bad'},
    {hudScale:-5},
    {quality:'broken'},
    {aimMode:'unrecognized'},
    {invertY:'sideways'}
  ]){
    storage.setItem(SETTINGS_KEY,JSON.stringify({version:1,settings:field}));
    assert.deepEqual(store.load(),{ok:false,reason:'invalid-settings',settings:null},JSON.stringify(field));
    assert.equal(store.save(field).ok,false,`save must not persist ${JSON.stringify(field)}`);
  }
  assert.equal(store.save({quality:'low',sensitivity:1.25,masterVolume:.4,invertY:'true',volume:.5}).ok,true);
  assert.deepEqual(store.load().settings,{quality:'low',sensitivity:1.25,masterVolume:.4,invertY:'true',volume:.5});
});
