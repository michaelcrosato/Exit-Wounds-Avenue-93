import test from 'node:test';
import assert from 'node:assert/strict';
import {CompanionActor} from '../../src/actors/companion.js';
import {FOOT_GRAPH} from '../../src/world/roads.js';

test('Jun follows the long quiet-stop to waterfront route without nearest-node oscillation',()=>{
  const jun=Object.create(CompanionActor.prototype);
  const actor={x:269*16,y:353*16,z:0,vx:0,vy:0,grounded:true,fell:false,anim:null};
  Object.assign(jun,{actor,graph:FOOT_GRAPH,queries:null,cover:[],onStuck:()=>{throw new Error('Jun could not progress');},active:true,mode:'follow',vehicleId:null,target:{x:269,y:353,z:0},path:[],pathGoalNode:null,stuckFor:0,lastProgress:{x:269,y:353,z:0},lastSafe:{x:269,y:353,z:0},recoveryAttempts:0,vaultState:null});
  const player={x:382,y:358,z:0};
  for(let i=0;i<1200;i++){
    jun.update(.05,{player});
    actor.x+=actor.vx*.05;actor.y+=actor.vy*.05;
  }
  assert.ok(Math.hypot(jun.position.x-player.x,jun.position.y-player.y)<8,`Jun stopped at ${JSON.stringify(jun.position)}`);
  assert.equal(jun.recoveryAttempts,0);
});

test('ground-floor Jun does not detour onto the upstairs office landing during extraction',()=>{
  const jun=Object.create(CompanionActor.prototype);
  jun.graph=FOOT_GRAPH;
  const from={x:330.9,y:82.9,z:.1},door={x:333,y:89,z:.1},outside={x:348,y:212,z:.1};
  for(const target of [door,outside]){
    const route=jun.route(from,target);
    assert.ok(route.every(node=>(node.z||0)<1.6),`Ground route incorrectly visits ${route.map(node=>node.id).join(', ')}`);
    assert.ok(route.some(node=>node.id==='depot-office'));
  }
  assert.equal(jun.nearestNode(from)?.id,'depot-case');
  const upper=jun.route({x:333,y:85,z:3.2},door);
  assert.ok(upper.some(node=>node.id==='office-stair-top'),'Actual upstairs route still descends stairs');
});

test('Jun below an upstairs player routes to stairs instead of treating 2D overlap as arrival',()=>{
  const jun=Object.create(CompanionActor.prototype);
  const actor={x:333*16,y:85*16,z:.1*16,vx:0,vy:0,grounded:true,fell:false,anim:null};
  Object.assign(jun,{actor,graph:FOOT_GRAPH,queries:null,cover:[],onStuck:()=>{},active:true,mode:'follow',vehicleId:null,
    target:{x:333,y:85,z:.1},path:[],pathGoalNode:null,stuckFor:0,lastProgress:{x:333,y:85,z:.1},lastSafe:{x:333,y:85,z:.1},recoveryAttempts:0,vaultState:null});
  jun.update(.05,{player:{x:333,y:85,z:3.2}});
  assert.ok(jun.path.some(node=>node.id==='office-stair-top'));
  assert.ok(Math.hypot(actor.vx,actor.vy)>0,'Jun must move toward the stairs despite sharing the upstairs target X/Y');
});
