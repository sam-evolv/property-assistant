/**
 * Themed Joke Library for OpenHouse AI Assistant
 * 
 * Categories: AI, Houses, Moving, Neighborhoods, Property
 * Provides personality and humor when users ask for jokes
 */

export interface Joke {
  setup: string;
  punchline: string;
  category: 'ai' | 'house' | 'moving' | 'neighborhood' | 'property';
}

const JOKES: Joke[] = [
  // AI Jokes
  {
    setup: "Why did the AI assistant go to therapy?",
    punchline: "It had too many unresolved queries!",
    category: 'ai'
  },
  {
    setup: "What do you call an AI that sings?",
    punchline: "A-lyric-a!",
    category: 'ai'
  },
  {
    setup: "Why don't AI assistants ever get lonely?",
    punchline: "Because we're always processing your requests!",
    category: 'ai'
  },
  {
    setup: "What's an AI's favourite type of music?",
    punchline: "Algo-rhythm and blues!",
    category: 'ai'
  },
  {
    setup: "Why did the chatbot break up with the calculator?",
    punchline: "It felt like the relationship was too calculating!",
    category: 'ai'
  },
  {
    setup: "How does an AI take its coffee?",
    punchline: "With a byte of data on the side!",
    category: 'ai'
  },
  {
    setup: "Why was the AI bad at poker?",
    punchline: "It kept showing its neural network!",
    category: 'ai'
  },
  {
    setup: "What did the AI say when asked about its weekend plans?",
    punchline: "I'm just going to stay home and process some thoughts!",
    category: 'ai'
  },

  // House Jokes
  {
    setup: "Why did the house go to the doctor?",
    punchline: "It had a bad case of window panes!",
    category: 'house'
  },
  {
    setup: "What room can you never enter?",
    punchline: "A mushroom!",
    category: 'house'
  },
  {
    setup: "Why do houses make terrible comedians?",
    punchline: "They always crack under pressure!",
    category: 'house'
  },
  {
    setup: "What did the big chimney say to the small chimney?",
    punchline: "You're too young to smoke!",
    category: 'house'
  },
  {
    setup: "Why was the house so good at its job?",
    punchline: "It really knew how to stay grounded!",
    category: 'house'
  },
  {
    setup: "What do you call a nervous house?",
    punchline: "A jittery dwelling!",
    category: 'house'
  },
  {
    setup: "Why did the wall see a therapist?",
    punchline: "It had too many issues to plaster over!",
    category: 'house'
  },
  {
    setup: "What's a house's favourite chocolate?",
    punchline: "A-door-ables!",
    category: 'house'
  },

  // Moving Jokes
  {
    setup: "Why did the family bring a ladder to their new house?",
    punchline: "They heard the property market was on the rise!",
    category: 'moving'
  },
  {
    setup: "What do you call someone who's moved three times in a year?",
    punchline: "Relocating champ... or just really indecisive!",
    category: 'moving'
  },
  {
    setup: "Why do moving boxes never feel sad?",
    punchline: "They know things will always pick up!",
    category: 'moving'
  },
  {
    setup: "What did the sofa say during the house move?",
    punchline: "I'm going through a lot of changes right now!",
    category: 'moving'
  },
  {
    setup: "Why are removals companies so optimistic?",
    punchline: "They're always looking forward to the next move!",
    category: 'moving'
  },
  {
    setup: "What's a mover's favourite exercise?",
    punchline: "Box jumps, obviously!",
    category: 'moving'
  },
  {
    setup: "Why did the homeowner bring a map to the new house?",
    punchline: "They didn't want to get lost finding the bathroom at 3am!",
    category: 'moving'
  },
  {
    setup: "What do you call unpacking that takes forever?",
    punchline: "A slow reveal... or every move I've ever done!",
    category: 'moving'
  },

  // Neighborhood Jokes
  {
    setup: "Why did the new neighbour bring cookies to everyone?",
    punchline: "They wanted to make a sweet first impression!",
    category: 'neighborhood'
  },
  {
    setup: "What do you call a street where everyone knows each other?",
    punchline: "Friendly avenue!",
    category: 'neighborhood'
  },
  {
    setup: "Why did the fence get promoted?",
    punchline: "It was outstanding in its field!",
    category: 'neighborhood'
  },
  {
    setup: "What's the best thing about quiet neighbours?",
    punchline: "Absolutely nothing... you never hear from them!",
    category: 'neighborhood'
  },
  {
    setup: "Why don't streets ever get lost?",
    punchline: "They always follow their own path!",
    category: 'neighborhood'
  },
  {
    setup: "What did one cul-de-sac say to the other?",
    punchline: "We really need to branch out more!",
    category: 'neighborhood'
  },
  {
    setup: "Why was the community centre always happy?",
    punchline: "It was at the heart of everything!",
    category: 'neighborhood'
  },
  {
    setup: "What do you call a really friendly postman?",
    punchline: "First-class service!",
    category: 'neighborhood'
  },

  // Property Jokes
  {
    setup: "Why did the estate agent bring a ladder to work?",
    punchline: "To help clients reach new heights in the market!",
    category: 'property'
  },
  {
    setup: "What's a ghost's favourite part of buying a house?",
    punchline: "The boo-yer's report!",
    category: 'property'
  },
  {
    setup: "Why do mortgages never feel lonely?",
    punchline: "They're always attached to something!",
    category: 'property'
  },
  {
    setup: "What did the first-time buyer say to the bank?",
    punchline: "I'm ready to make some serious commitments!",
    category: 'property'
  },
  {
    setup: "Why was the property valuation always optimistic?",
    punchline: "It knew things could only look up!",
    category: 'property'
  },
  {
    setup: "What's a builder's favourite type of music?",
    punchline: "Heavy metal... and concrete beats!",
    category: 'property'
  },
  {
    setup: "Why did the buyer fall in love with the house?",
    punchline: "It had great kerb appeal and a heart of oak!",
    category: 'property'
  },
  {
    setup: "What do you call a really smooth property transaction?",
    punchline: "A key moment in history!",
    category: 'property'
  },
];

const JOKE_INTROS = [
  "Here's one for you!",
  "Alright, ready for this?",
  "Okay, I've got a good one...",
  "Right, brace yourself...",
  "Here we go!",
  "I've been saving this one...",
  "This should give you a smile!",
  "Hope this brightens your day!",
];

const JOKE_OUTROS = [
  "Hope that gave you a chuckle!",
  "I'll be here all week! Well, literally... I'm an AI.",
  "Comedy gold, right? No? Okay, moving on...",
  "Tough crowd? I've got more where that came from!",
  "Still here if you need anything else!",
  "And now back to our regularly scheduled property chat!",
  "Laughter is the best medicine... but I can also help with nearby pharmacies!",
  "That's my best material! Is there anything property-related I can help with?",
];

let lastJokeIndex = -1;

export function getRandomJoke(): { intro: string; joke: Joke; outro: string } {
  let index: number;
  do {
    index = Math.floor(Math.random() * JOKES.length);
  } while (index === lastJokeIndex && JOKES.length > 1);
  
  lastJokeIndex = index;
  
  const intro = JOKE_INTROS[Math.floor(Math.random() * JOKE_INTROS.length)];
  const outro = JOKE_OUTROS[Math.floor(Math.random() * JOKE_OUTROS.length)];
  
  return {
    intro,
    joke: JOKES[index],
    outro,
  };
}

export function formatJokeResponse(): string {
  const { intro, joke, outro } = getRandomJoke();
  
  return `${intro}\n\n**${joke.setup}**\n\n${joke.punchline}\n\n${outro}`;
}

export function getJokeCount(): number {
  return JOKES.length;
}

export function getJokesByCategory(category: Joke['category']): Joke[] {
  return JOKES.filter(j => j.category === category);
}
