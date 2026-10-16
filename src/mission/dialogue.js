/** Original authored lines. Phone archives retain essential information if any scene is interrupted. */
export const DIALOGUE = Object.freeze({
  intro: [
    { speaker: 'Eli', text: 'Depot shuts down, then the city bills us for the locks. Funny kind of recovery work.' },
    { speaker: 'Mara', text: 'You said there was a collection.' },
    { speaker: 'Eli', text: 'Sealed payroll case. Bea has the address. Sedan is fueled; your pistol is in the glove box. Bring the case back clean.' },
    { speaker: 'Eli', text: 'There is a misplaced toolbox by the market. Bring it to my bay and I owe you one repair and a fresh coat.' },
  ],
  'collection-drive': [
    { speaker: 'Eli', text: 'Ward used to sound different at shift change. More people. Fewer alarms.' },
    { speaker: 'Mara', text: 'Still plenty of people waiting to get paid.' },
  ],
  collection: [
    { speaker: 'Bea', text: 'They moved your case to dispatch. Northeast depot, ground-floor records office.' },
    { speaker: 'Bea', text: 'Crew is holding a clerk named Jun. Front gate is watched. Service lane has a low fence and one guard.' },
    { speaker: 'Mara', text: 'A collection was supposed to mean someone had agreed to give it back.' },
  ],
  'depot-message': [
    { speaker: 'Eli', text: 'Bea told me about Jun. Do not leave him in there. Two ways in: street gate or service lane. Your call.' },
  ],
  'jun-discovery': [
    { speaker: 'Jun', text: 'You are not with their recovery crew?' },
    { speaker: 'Mara', text: 'That depends what is in the case.' },
    { speaker: 'Jun', text: 'Pay records. Real ones. Workers paid the contractor; the contractor paid itself.' },
    { speaker: 'Jun', text: 'Cabinet is wired. Open it and dispatch gets an alarm. I am coming with you.' },
  ],
  alarm: [
    { speaker: 'Dispatcher', text: 'Dispatch depot: wired cabinet alarm. Suspected theft. Send two patrols to investigate. No suspect description.' },
    { speaker: 'Jun', text: 'They know where. They do not know us yet. Sedan or van, just get us outside.' },
  ],
  evasion: [
    { speaker: 'Jun', text: 'They lose sight, they search the last place they saw us. Get beyond it.' },
    { speaker: 'Eli', text: 'If you earned that favor, my bay is open. Only come in when the police cannot see your car.' },
  ],
  decision: [
    { speaker: 'Jun', text: 'The broker pays twelve hundred to make this disappear. A reporter at the waterfront can pay six.' },
    { speaker: 'Mara', text: 'And the difference buys what?' },
    { speaker: 'Jun', text: 'A chance the next crew gets paid. Your choice. I walk away alive either way.' },
  ],
  'broker-handoff': [
    { speaker: 'Broker', text: 'Seals intact. Twelve hundred, as agreed. Forget the names.' },
    { speaker: 'Jun', text: 'I will remember them. Somebody should.' },
    { speaker: 'Mara', text: 'You are out. That part of the job is done.' },
  ],
  'reporter-handoff': [
    { speaker: 'Reporter', text: 'Payroll, signatures, transfers. We can publish this. Six hundred is all the fund has.' },
    { speaker: 'Jun', text: 'Print the workers first. They have waited long enough.' },
    { speaker: 'Mara', text: 'Then let us give them something to read in the morning.' },
  ],
  aftermath: [{ speaker: 'Eli', text: 'Garage light is on. Whatever comes next, there is a place to park.' }],
});
export const MESSAGES = Object.freeze({
  'eli-opening': { from: 'Eli', text: 'Meet me in the garage. Collection job; sedan and pistol supplied.' },
  'eli-missed': { from: 'Eli', text: 'Missed you. Call me back for the collection details, or come to the garage. The work will wait.' },
  'depot-address': { from: 'Bea', text: 'Dispatch depot, northeast. Jun and the payroll case are in the ground-floor records office. Gate or rear service lane.' },
  'favor-earned': { from: 'Eli', text: 'Toolbox received. One free repair and respray. Lose police sight before using my bay.' },
  'broker-ending': { from: 'Jun', text: 'I am safe. The contractor has taken the market lease. I hope the money gets you somewhere.' },
  'reporter-ending': { from: 'Jun', text: 'I am safe. They opened an investigation. People at the market are saying our names.' },
});
/** @param {string} id */
export function dialogueLines(id) { return DIALOGUE[id] ?? []; }
/** @param {import('../game/state.js').GameState} state @param {'eli'|'bea'} contact */
export function contactResponse(state, contact) {
  if (contact === 'bea') return state.mission.phase === 'INTRO' || state.mission.phase === 'COLLECTION'
    ? 'Find me by the market counter. I have the updated collection address.'
    : 'Dispatch depot, northeast. The front gate and service lane both reach the office. Stay safe.';
  if (state.mission.favor === 'earned') return 'Your free repair and respray is waiting in my garage. Lose police sight first.';
  if (state.mission.favor === 'available' || state.mission.favor === 'carrying') return 'Bring the misplaced market toolbox to my bay. I will owe you one repair and respray.';
  return state.mission.completed ? 'Garage is open. Come by for repairs, or take a drive. You earned the quiet.' : 'Keep Jun with you. If a route closes, use the other streets. Garage is open for repairs.';
}
