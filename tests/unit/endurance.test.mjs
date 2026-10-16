import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState} from '../../src/game/state.js';
import {CrimeSystem} from '../../src/systems/crime.js';
import {WantedSystem} from '../../src/systems/wanted.js';

test('long repeated reported crimes keep bounded history without erasing active investigation',()=>{
  const state=createGameState(),wanted=new WantedSystem(state),crime=new CrimeSystem(state,wanted);
  for(let i=0;i<900;i++){
    state.tick=i*240;
    const id=`incident-${i}`;
    crime.recordCrime({id,kind:'gunfire',position:{x:100+i*.01,y:200,z:0},severity:2,perpetratorId:'mara',vehicleId:null,tick:state.tick});
    crime.observe({crimeId:id,witnessId:`officer-${i}`,witnessKind:'police',hasLineOfSight:true,seesPerson:true});
    crime.tick(1/120);
  }
  assert.equal(wanted.active,true);
  assert.ok(state.crime.incidents.length<=256);
  assert.ok(state.crime.reports.length<=384);
  assert.ok(state.wanted.reportsReceived.length<=384);
  assert.equal(state.crime.incidents.at(-1).id,'incident-899');
  assert.equal(state.wanted.personId,'mara');
});
