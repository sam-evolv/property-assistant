/**
 * Local History Knowledge Base for Longview Park and Rathard Park
 * 
 * Chunked historical facts, stories, and heritage information
 * for the Ballyvolane, Lahardane, and Ballincolly area.
 * 
 * IMPORTANT: This content is ONLY for Longview Park and Rathard Park schemes.
 */

export interface HistoricalFact {
  id: string;
  category: 'etymology' | 'archaeology' | 'people' | 'folklore' | 'trade' | 'independence' | 'landmarks' | 'nature';
  title: string;
  content: string;
  funFact?: string;
  period?: string;
}

const LOCAL_HISTORY_FACTS: HistoricalFact[] = [
  // ETYMOLOGY - Place name meanings
  {
    id: 'etymology-ballyvolane',
    category: 'etymology',
    title: 'The Meaning of Ballyvolane',
    content: 'The name Ballyvolane comes from the Irish "Baile Uí Mhaoláin" meaning "The Homestead of O\'Mullane." An alternative interpretation suggests it could derive from "Baile na bhFoilán" - "the place of springing heifers" - which points to the area\'s long history as fertile agricultural land.',
    funFact: 'Your neighbourhood has been farming country for over a thousand years!',
    period: 'Medieval'
  },
  {
    id: 'etymology-lahardane',
    category: 'etymology',
    title: 'The Meaning of Lahardane',
    content: 'Lahardane translates from Irish as "Leathardán" meaning "The Gentle Slope." This is a beautifully precise topographical description - the land here rises gently northward from the Glen River valley toward the higher ground at Whites Cross.',
    funFact: 'The ancient Irish named places with remarkable geographical accuracy!',
    period: 'Ancient'
  },
  {
    id: 'etymology-ballincolly',
    category: 'etymology',
    title: 'The Meaning of Ballincolly',
    content: 'Ballincolly derives from the Irish "Baile an Cholaigh" - "The Town of the Boar." This evocative name suggests a landscape once covered in dense oak forests that were home to wild boar, now long vanished from Ireland.',
    funFact: 'Wild boar once roamed freely through the oak forests where your home now stands!',
    period: 'Ancient'
  },
  {
    id: 'etymology-whites-cross',
    category: 'etymology',
    title: 'The Story of Whites Cross',
    content: 'Whites Cross gets its name from the prominent Anglo-Irish White family who were significant landowners in the 17th and 18th centuries. The "cross" refers to the historic junction of roads - the route to Mallow in the north meets the Ballyhooly Road here.',
    funFact: 'The crossroads at Whites Cross has been a meeting point for travellers for centuries.',
    period: '17th-18th Century'
  },

  // ARCHAEOLOGY - Ancient sites
  {
    id: 'archaeology-fulacht',
    category: 'archaeology',
    title: 'Bronze Age Cooking Sites',
    content: 'Archaeological surveys have identified ancient "fulacht fiadh" (burnt mounds) in Lahardane and nearby Rathcooney. These Bronze Age sites, dating from around 1500 BCE, were outdoor cooking places where stones were heated and dropped into water-filled wooden troughs to cook meat.',
    funFact: 'People were cooking Sunday roasts in your area 3,500 years ago!',
    period: 'Bronze Age (c. 1500 BCE)'
  },
  {
    id: 'archaeology-standing-stones',
    category: 'archaeology',
    title: 'The Standing Stones',
    content: 'Standing stones in nearby Garraneboy and Lahardane date from the Bronze or Iron Age. These mysterious monuments likely marked territorial boundaries, astronomical alignments, or sacred ritual spaces. They are silent witnesses to ceremonies long forgotten.',
    funFact: 'Ancient standing stones still mark the landscape around your new home.',
    period: 'Bronze/Iron Age'
  },
  {
    id: 'archaeology-ringforts',
    category: 'archaeology',
    title: 'Early Medieval Ringforts',
    content: 'The surrounding townlands contain numerous "raths" - circular earthen enclosures that were farmsteads during the Early Medieval period (400-1200 AD). These sites indicate a thriving dairy-based economy in the area over a thousand years ago.',
    funFact: 'The circular earthen banks you might see in fields were once the walls of medieval farms!',
    period: 'Early Medieval (400-1200 AD)'
  },

  // NOTABLE PEOPLE - Historical figures
  {
    id: 'people-coppinger',
    category: 'people',
    title: 'The Coppinger Family',
    content: 'The Coppinger family of Ballyvolane House were wealthy Cork merchant princes. According to local legend, when Oliver Cromwell\'s forces arrived in 1649, the Coppingers offered such lavish hospitality that Cromwell spared their estate from destruction - one of the few Catholic properties to survive.',
    funFact: 'Legend says a good dinner party saved Ballyvolane from Cromwell!',
    period: '17th Century'
  },
  {
    id: 'people-wine-geese',
    category: 'people',
    title: 'The Wine Geese of Bordeaux',
    content: 'After the Williamite wars, many Irish Catholic merchant families, including those connected to this area, became "Wine Geese" - emigrating to Bordeaux, France where they built famous wine estates. Some of Bordeaux\'s most prestigious chateaux were founded by Cork families.',
    funFact: 'Some of France\'s finest wines are made by descendants of Cork merchants!',
    period: '18th Century'
  },
  {
    id: 'people-brian-dillon',
    category: 'people',
    title: 'Brian Dillon - Fenian Leader',
    content: 'Kilcully Cemetery, near the area, contains the grave of Brian Dillon, a prominent Fenian leader of the 1860s who fought for Irish independence. His grave became a place of pilgrimage for later generations of republicans.',
    funFact: 'A famous Irish revolutionary is buried just minutes from your new home.',
    period: '19th Century'
  },

  // TRADE - Butter roads and commerce
  {
    id: 'trade-butter-road',
    category: 'trade',
    title: 'The Butter Road',
    content: 'The Ballyhooly Road that borders the area was historically known as a "Butter Road" - one of the vital arteries that connected the rich dairy farms of North Cork to Cork city\'s famous Butter Exchange. In the 18th and 19th centuries, Cork butter was exported worldwide.',
    funFact: 'Cork butter was once famous from Brazil to India - and it travelled past your doorstep!',
    period: '18th-19th Century'
  },
  {
    id: 'trade-butter-exchange',
    category: 'trade',
    title: 'Cork\'s Global Butter Trade',
    content: 'Cork\'s Butter Exchange, founded in 1770, was the largest butter market in the world. Farmers from the Ballyvolane area would bring their butter kegs down the Ballyhooly Road to the Exchange, where it was graded, packed in firkins, and shipped across the globe.',
    funFact: 'Cork was once the butter capital of the world!',
    period: '18th-19th Century'
  },

  // WAR OF INDEPENDENCE - Revolutionary history
  {
    id: 'independence-whites-cross',
    category: 'independence',
    title: 'The Whites Cross Ambush',
    content: 'In 1920, during the War of Independence, the Whites Cross junction was the scene of an IRA ambush against British forces. The local countryside provided cover for the Irish Volunteers who operated in the area, using their knowledge of local lanes and fields.',
    funFact: 'The crossroads near your home was once a battleground for Irish freedom.',
    period: '1920'
  },
  {
    id: 'independence-sean-odonoghue',
    category: 'independence',
    title: 'Commandant Seán O\'Donoghue',
    content: 'During the Civil War in 1922, Commandant Seán O\'Donoghue, a prominent local IRA leader, was killed in the area. His death was mourned throughout Cork, and he is remembered as one of the heroes of the revolutionary period.',
    funFact: 'Local heroes of the fight for independence are buried in nearby cemeteries.',
    period: '1922'
  },
  {
    id: 'independence-republican-plots',
    category: 'independence',
    title: 'The Republican Plots',
    content: 'Kilcully Cemetery and Rathcooney Cemetery contain dedicated Republican Plots where volunteers from the War of Independence and Civil War are buried. These peaceful graveyards preserve the memory of those who fought for Irish freedom.',
    period: '1916-1923'
  },

  // LANDMARKS - Historic houses and features
  {
    id: 'landmarks-lahardane-house',
    category: 'landmarks',
    title: 'Lahardane House',
    content: 'Lahardane House was once a gentry residence, home to prosperous farming families who worked the fertile slopes. These houses represented the agricultural wealth of North Cork and the social aspirations of the merchant and farming classes.',
    period: '18th-19th Century'
  },
  {
    id: 'landmarks-flower-hill',
    category: 'landmarks',
    title: 'Flower Hill House',
    content: 'Flower Hill House, with its evocative name, was another significant residence in the area. These houses often had extensive gardens, orchards, and demesne lands that shaped the landscape we see today.',
    period: '18th-19th Century'
  },

  // FOLKLORE - Local legends and stories
  {
    id: 'folklore-gleann-caoin',
    category: 'folklore',
    title: 'The Tragedy of Gleann Caoin',
    content: 'Local folklore tells of "Gleann Caoin" (The Glen of Weeping) - a tragic tale associated with a nearby valley. The story, passed down through generations, speaks of heartbreak and loss, giving the landscape an air of romantic melancholy.',
    funFact: 'Every valley and hill has stories that have been told for generations.',
    period: 'Folklore'
  },
  {
    id: 'folklore-faerie-forts',
    category: 'folklore',
    title: 'The Faerie Forts',
    content: 'The ringforts (raths) scattered across the landscape were traditionally known as "faerie forts" in local folklore. Farmers refused to disturb them for fear of offending the "good people" who supposedly lived within. This superstition actually helped preserve many ancient sites!',
    funFact: 'Superstition about faeries accidentally saved ancient archaeology!',
    period: 'Folklore'
  },
  {
    id: 'folklore-hidden-treasure',
    category: 'folklore',
    title: 'Tales of Hidden Treasure',
    content: 'Like many parts of Ireland, the area has its legends of hidden treasure - gold coins buried during times of trouble, or the hoards of ancient chieftains waiting to be discovered. While no treasure has been found, the stories add mystery to the landscape.',
    funFact: 'Keep your eyes open - local legend says there\'s treasure buried somewhere nearby!',
    period: 'Folklore'
  },

  // NATURE - Rivers and landscape
  {
    id: 'nature-glen-river',
    category: 'nature',
    title: 'The Glen River',
    content: 'The Glen River, which rises in the Ballincolly area, was once a vital waterway that powered Cork\'s industrial growth. Mills along its banks ground grain, spun wool, and drove the machinery that made Cork a major manufacturing centre.',
    funFact: 'The streams near your home once powered the factories that built Cork\'s prosperity.',
    period: '18th-19th Century'
  },
  {
    id: 'nature-oak-forests',
    category: 'nature',
    title: 'The Lost Oak Forests',
    content: 'The name Ballincolly ("Town of the Boar") reminds us that this area was once covered in dense oak forests. These woods were home to wild boar, wolves, and deer before being cleared for agriculture over the centuries.',
    funFact: 'Wolves and wild boar once roamed where you now walk your dog!',
    period: 'Medieval and Earlier'
  },
];

const LOCAL_HISTORY_INTROS = [
  "Here's an interesting bit of local history for you!",
  "Did you know this about your area?",
  "Here's a fascinating fact about the neighbourhood...",
  "The history around here is really interesting!",
  "Let me share a piece of local heritage with you...",
  "Here's something you might not know about the area...",
  "There's a great story connected to this place...",
  "The history of this area is rich - here's a snippet!",
];

export const LONGVIEW_RATHARD_SCHEME_IDS = [
  'longview-park',
  'rathard-park',
  'longview',
  'rathard',
];

export function isLongviewOrRathardScheme(schemeName?: string | null): boolean {
  if (!schemeName) return false;
  const normalized = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return LONGVIEW_RATHARD_SCHEME_IDS.some(id => 
    normalized.includes(id.replace('-', ''))
  );
}

const HISTORY_TRIGGER_PATTERNS = [
  /\b(local\s+)?history\b/i,
  /\b(interesting|fun)\s*(facts?|stories?)\b/i,
  /\bheritage\b/i,
  /\btell\s*me\s*(about|something).*(area|place|neighbourhood|neighborhood)\b/i,
  /\bwhat('s| is)\s*(the\s+)?history\b/i,
  /\bstories?\s*(about|of)\s*(the\s+)?(area|place|neighbourhood)\b/i,
  /\bwhere\s+does?\s+the\s+name\s+come\s+from\b/i,
  /\bname\s+(mean|meaning|origin)\b/i,
  /\bplace\s+name\b/i,
  /\barchaeolog(y|ical)\b/i,
  /\bancient\b/i,
  /\bfolk(lore|tales?)\b/i,
  /\blegends?\b/i,
  /\bwar\s+of\s+independence\b/i,
  /\brevolution(ary)?\b/i,
  /\bbronze\s+age\b/i,
  /\bmedieval\b/i,
  /\bhistoric(al)?\s*(facts?|sites?|places?)?\b/i,
  /\btrade\s+(history|routes?)\b/i,
  /\bbutter\s+(road|exchange|trade)\b/i,
  /\bballyvolane\b/i,
  /\blahardane\b/i,
  /\bballincolly\b/i,
  /\bwhites?\s*cross\b/i,
  /\bcoppinger\b/i,
  /\bring\s*forts?\b/i,
  /\bfulacht\b/i,
  /\bstanding\s+stones?\b/i,
];

export function isLocalHistoryQuery(message: string): boolean {
  return HISTORY_TRIGGER_PATTERNS.some(p => p.test(message));
}

export function detectHistoryCategory(message: string): HistoricalFact['category'] | null {
  const m = message.toLowerCase();
  
  if (/name\s*(mean|origin)|etymology|where.*name\s+come/i.test(m)) return 'etymology';
  if (/archaeolog|bronze\s+age|iron\s+age|ancient|standing\s+stone|fulacht|ring\s*fort/i.test(m)) return 'archaeology';
  if (/coppinger|dillon|famous|notable|who\s+lived/i.test(m)) return 'people';
  if (/folklore|legend|faerie|fairy|treasure|stories?\s+about/i.test(m)) return 'folklore';
  if (/butter|trade|commerce|exchange|merchant/i.test(m)) return 'trade';
  if (/independence|revolution|ira|ambush|civil\s+war|1916|1920|1922/i.test(m)) return 'independence';
  if (/house|mansion|estate|landmark|building/i.test(m)) return 'landmarks';
  if (/river|forest|nature|wildlife|oak|boar/i.test(m)) return 'nature';
  
  return null;
}

let lastFactIndex = -1;
let usedFactIds: Set<string> = new Set();

export function getLocalHistoryFact(category?: HistoricalFact['category'] | null): { intro: string; fact: HistoricalFact } {
  let eligibleFacts = LOCAL_HISTORY_FACTS;
  
  if (category) {
    eligibleFacts = LOCAL_HISTORY_FACTS.filter(f => f.category === category);
    if (eligibleFacts.length === 0) {
      eligibleFacts = LOCAL_HISTORY_FACTS;
    }
  }
  
  const unusedFacts = eligibleFacts.filter(f => !usedFactIds.has(f.id));
  if (unusedFacts.length === 0) {
    usedFactIds.clear();
  }
  
  const pool = unusedFacts.length > 0 ? unusedFacts : eligibleFacts;
  const randomIndex = Math.floor(Math.random() * pool.length);
  const fact = pool[randomIndex];
  
  usedFactIds.add(fact.id);
  
  const intro = LOCAL_HISTORY_INTROS[Math.floor(Math.random() * LOCAL_HISTORY_INTROS.length)];
  
  return { intro, fact };
}

export function formatLocalHistoryResponse(category?: HistoricalFact['category'] | null): string {
  const { intro, fact } = getLocalHistoryFact(category);
  
  let response = `${intro}\n\n**${fact.title}**\n\n${fact.content}`;
  
  if (fact.funFact) {
    response += `\n\n*${fact.funFact}*`;
  }
  
  if (fact.period) {
    response += `\n\n_(${fact.period})_`;
  }
  
  response += '\n\nWould you like to hear another interesting fact about the area?';
  
  return response;
}

export function getFactsByCategory(category: HistoricalFact['category']): HistoricalFact[] {
  return LOCAL_HISTORY_FACTS.filter(f => f.category === category);
}

export function getAllCategories(): HistoricalFact['category'][] {
  return ['etymology', 'archaeology', 'people', 'folklore', 'trade', 'independence', 'landmarks', 'nature'];
}

export function getTotalFactCount(): number {
  return LOCAL_HISTORY_FACTS.length;
}
