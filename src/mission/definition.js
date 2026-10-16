export const MISSION_ID = 'the-last-collection';
export const CREW_IDS = Object.freeze(['crew-guard-gate', 'crew-guard-service', 'crew-rusher-1', 'crew-rusher-2', 'crew-flanker-1', 'crew-flanker-2']);
export const MAX_PRESSURING_ENEMIES = 4;
export const MAX_ACTIVE_ARMED_NPCS = 10;
export const ENDINGS = Object.freeze({
  broker: { label: 'Broker — $1,200', destination: 'broker', reward: 1200, messageId: 'broker-ending', consequence: 'contractor-takeover' },
  reporter: { label: 'Reporter — $600', destination: 'waterfront', reward: 600, messageId: 'reporter-ending', consequence: 'investigation' },
});
export const PHASES = Object.freeze({
  INTRO: { objective: "Answer Eli's call or meet him inside the garage to accept the collection job.", locationId: 'garage', dialogueId: 'intro', checkpoint: 'new-run' },
  COLLECTION: { objective: 'Drive to Bea at the market frontage.', locationId: 'market', dialogueId: 'collection-drive', checkpoint: 'job-accepted' },
  APPROACH: { objective: 'Reach the dispatch depot. Choose the street gate or rear service lane.', locationId: 'depot', dialogueId: 'depot-message', checkpoint: 'depot-approach' },
  RECOVERY: { objective: 'Find Jun in the depot office and recover the payroll case.', locationId: 'case-cabinet', dialogueId: 'jun-discovery', checkpoint: 'recovery' },
  EXTRACTION: { objective: 'Get Jun out of the depot. Use the sedan, the yard van, or a safe foot route.', locationId: 'depot-exit', dialogueId: 'alarm', checkpoint: 'case-recovered' },
  EVASION: { objective: 'Lose police sight, then leave the search area.', locationId: null, dialogueId: 'evasion', checkpoint: 'escape' },
  DECISION: { objective: 'Talk to Jun. Choose the broker or the neighborhood reporter.', locationId: null, dialogueId: 'decision', checkpoint: 'decision' },
  HANDOFF: { objective: 'Confirm the handoff at your chosen destination.', locationId: null, dialogueId: 'handoff', checkpoint: null },
  AFTERMATH: { objective: "The Last Collection complete. Explore Morrow Ward, visit Eli, or replay from Pause.", locationId: 'garage', dialogueId: 'aftermath', checkpoint: 'completed' },
});
