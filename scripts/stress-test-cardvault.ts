import 'dotenv/config';
import { searchCard } from '../src/cardvault.js';

const cards = [
  // Heroes
  'Aurora', 'Ira', 'Vynnset', 'Enigma', 'Verdance', 'Riptide', 'Maxx Nitro',
  'Nuu', 'Jarl', 'Yorick', 'Marlynn', 'Olympia', 'Cindra', 'Teklovossen',
  'Taylor', 'Emperor', 'Ben', 'Yoji', 'Zen', 'Rhinar', 'Dorinthea', 'Katsu',
  'Arakni', 'Briar', 'Chane', 'Dash', 'Iyslander', 'Lexi', 'Oldhim', 'Prism',
  'Viserai', 'Azalea', 'Phanessa', 'Florian', 'Levia', 'Kayo', 'Kassai', 'Fai',
  'Dromai', 'Uzuri', 'Brevant', 'Boltyn', 'Shiyana', 'Betsy', 'Bravo', 'Kano',
  'Aphrodite', 'Theseus', 'Achilles', 'Roko',
  // Equipment
  'Galvanize', 'Tunic Force', 'Goring Grunkle', "Fyendal's Forged Hammer",
  'Crucible of Aetherweave', 'Tower of Inception', 'Diamond Pommel',
  'Bloodsheath Skeleta', 'Diametric Helm', 'Bramblefell Hood', 'Snowtread Boots',
  'Talisman of Ice', 'Imperial Plating', 'Skeletal Cleaver',
  'Vest of the First Fist', 'Sandwurmblade', 'Pulse of Isenloft',
  'Sigil of Solace', 'Twinning Blade', 'Endless Toil', 'Eye of Ophidia',
  "Heart of Fyendal", 'Coalescence Cape', 'Refraction Bolters',
  'Skullbone Crosier', 'Sigil of Permanence', 'Pulsewave Harpoon',
  'Anothos Bayonet', 'Plenipotentiary Pitcher', 'Mauvrion Skies',
  'Aether Spindle', 'Snapdragon Scalers', 'Crown of Providence',
  'Heartened Cross Strap', 'Glistening Steelblade', 'Tide Flippers',
  'Hatchet of Body', 'Hatchet of Mind', 'Hatchet of Spirit',
  'Hope Merchant\'s Hood', 'Talisman of Dousing', 'Goring Pegasi', 'Felt Hat',
  // Actions
  'Pummel', 'Enlightened Strike', 'Bloodrush Bellow', 'Razor Reflex',
  'Command and Conquer', 'Hypothermic Blast', 'Surging Strike', 'Frostbite',
  'Plunder Run', 'Burn Bare', 'Torrent of Tempo', 'Mugenshi', 'Timesnap Potion',
  'Stalagmite Shield', 'Codex of Frailty', 'Pounding Gale', 'Ravenous Rabble',
  'Scar for a Scar', 'Art of War', 'Rout', 'Lunging Press',
  'Springboard Somersault', 'Fluster Fist', 'Whelming Gustwave',
  'Ancestral Empowerment', 'Snapback', 'Seismic Surge', 'Invert Existence',
  'Snatch', 'Zealous Belting', 'Gloomveil', 'Spectral Shield', 'Frost Hex',
  'Engulf', 'Blizzard', 'Sonata Arcanix', 'Merciful Retribution',
  'Celestial Cataclysm', 'Nexus of Moment', 'Temporal Fissure',
  "Warmonger's Diplomacy", 'Savage Feast', 'Blood on Her Hands', 'Reckless Swing',
  'Nourishing Emptiness', 'Soulbead Strike', 'Shiver', 'Bleak Expanse',
  'Become the Arknight', 'Unhallowed Rites', 'Consuming Volition', 'Lunacy',
  'Herald of Erudition', 'Herald of Protection', 'Seek and Destroy',
  'Raging Onslaught', 'Crippling Crush', 'Silencer', 'Spinal Crush', 'Head Jab',
  'Leg Tap', 'Body Dash', 'Frailty', 'Courage', 'Rally', 'Remembrance',
  'Perseverance', 'Rifted Torment', 'Shadow of Ursur', 'Ruin', 'Dissolution',
  'Oath of the Arknight', 'Phantasm', 'Soul Harvest', 'Cold Snap', 'Frost Lock',
  'Glacial Footsteps', 'Icebind', 'Numbing Blow', 'Ice Quake', 'Tundra Stalker',
  'Snowblind', 'Blizzard Bolt', 'Polar Ice Storm', "Winter's Wail",
  'Frigid Fortitude', 'Glacial Horns', 'Frost Fang', 'Permafrost',
  'Glacial Crevasse', 'Bonds of Ancestry', 'Soaring Strike', 'Genesis',
  'Mythical Mimicry', 'Vexing Vagabond', 'Cathedral of Compunction',
  'Phantasmify', 'Beckon Demise', 'Ouroboros', 'Awaken Lightning', 'Surging Militia',
  'Crater Fist', 'Achilles Redoubt', 'Sky Skimmer', 'Stinging Sentinel',
  'Battery of Boltlight', 'Calling of the Wild', "Aria's Crescendo",
  'Diametric Pulse', 'Spike Pit', 'Pierced', 'Wrecker Romp', 'Wallop',
  'Bound by Bombast', 'Crash and Burn', 'Disable', 'Pinpoint Precision',
  'Lash of Lacerations', 'Hairpin Hold', 'Cog Counter', 'Boom Grenade',
  'Channel Lake Frigid', 'Cool Curio', 'Channel the Volcano', 'Cloudburst',
  'Cinderclaw Pinions', 'Crouching Tiger', 'Rok', 'Bottoms Up', 'Hop Off',
  "Bull's Strength", 'Pull of Gravity', 'Forge Breaker', 'Beast Within',
  'Yinti Yanti', 'Yu Quian', 'Crashing Tide', 'Channel Sword', 'Stir the Wildwood',
  'Cha-Ching!', 'Spoils of War', 'Treasure Trove', 'Greedy Grin',
  'Pulsewave Particulator', 'Buzz Off', 'Bloodletter', 'Bone Saw', 'Cogkata',
  'Cogtune', 'Burning Heart', 'Wax On', 'Wax Off', 'Drone of Brutality',
  'Sigil of Suffering', 'Drag Down', 'Embodiment of Earth', 'Sink Below',
  'Bramble Spark', 'Zero to Sixty', 'Zero to Fifty',
  // Specializations / signature
  'Sigil of Suffering', 'Soulbeat', 'Awakened Tide', 'Tear Asunder',
  'Brand with Cinderclaw', 'Channel Mount Heroic', 'Aether Quickening',
  'Talishar, the Lost Prince', 'Genis Wotchuneed', 'Rosetta Thorn',
  'Sift Sands', 'Phoenix Flame', 'Singeing Steelblade', 'Glistening Catscale Gloves',
  'Tiger Stripe Shuko', 'Breaking Scales', 'Whisper of the Vale',
  'Tome of Imperial Reverence', 'Death Touch', 'Reckless Conduct',
  'Slip Through the Sewers', 'Spreading Plague', 'Sleight of Hand',
  'Mask of Momentum', 'Ancestral Knowledge', 'Bloodspill Invocation',
  'Dawnblade', 'Edgecrafter', 'Lay Down the Law', 'Inertia Trap',
  'Diamond Pommel', 'Bramble Spark', 'Sigil of Solace',
  // Cards likely to be fuzzy / partial matches
  'Frost', 'Strike', 'Bolt', 'Hammer', 'Sword', 'Shield', 'Helm', 'Boots',
  'Cloak', 'Ring', 'Amulet', 'Crown', 'Mask', 'Glove', 'Spike',
  'Hex', 'Curse', 'Blessing', 'Pulse', 'Crash', 'Burn', 'Shatter',
  'Defy', 'Pierce', 'Cleave', 'Slash', 'Smash', 'Bash', 'Strike Down',
  'Burst', 'Wave', 'Flame', 'Frostfang', 'Ember', 'Cinder',
];

console.log(`Total cards in test: ${cards.length}`);

async function run() {
  console.log(`Firing ${cards.length} concurrent CardVault requests...\n`);
  const start = Date.now();

  const results = await Promise.allSettled(
    cards.map((name) => searchCard(name)),
  );

  let passed = 0;
  let failed = 0;
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      passed++;
    } else {
      failed++;
      console.log(`  ✗ ${cards[i]} → ${result.reason}`);
    }
  }

  console.log(
    `\n✓ ${passed} passed  ✗ ${failed} failed  in ${Date.now() - start}ms`,
  );
}

run();
