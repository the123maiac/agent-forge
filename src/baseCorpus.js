/* Pre-baked base corpus.
   Installs once into IndexedDB under agentId '__base__' and is shared
   by every agent that has `useBase: true`. Retrieval queries the base
   alongside the agent's private chunks, so the agent is competent on
   day one without any local training, and "learns" by accumulating
   per-agent chunks on top of this baseline. */

export const BASE_AGENT_ID = '__base__';
export const BASE_VERSION = 1;

/* Each entry becomes one chunk. Text is in "Q: ... A: ..." form so
   the dialogue retriever can return clean answers when a query strongly
   matches the question side. Topics span world knowledge, dialogue,
   meta, and how-to. */
const E = (title, text) => ({ title, text });

const KNOWLEDGE = [
  // Science
  E('photosynthesis', "Q: What is photosynthesis?\nA: The process plants, algae, and some bacteria use to turn sunlight, water, and carbon dioxide into glucose and oxygen. Chlorophyll inside chloroplasts captures the light energy."),
  E('gravity', "Q: What is gravity?\nA: A force of attraction between any two objects with mass. Earth's gravity gives weight; on the cosmic scale it shapes orbits, tides, and the structure of galaxies."),
  E('atom', "Q: What is an atom?\nA: The smallest unit of an element that keeps its chemical identity. Made of a nucleus of protons and neutrons orbited by electrons; almost all of its mass is in the nucleus."),
  E('dna', "Q: What is DNA?\nA: Deoxyribonucleic acid — a double-helix molecule that stores genetic instructions in sequences of four bases (A, T, G, C). Found in the nuclei of nearly every cell."),
  E('evolution', "Q: What is natural selection?\nA: The mechanism Darwin proposed for evolution: organisms with traits better suited to their environment leave more offspring, so those traits become more common over generations."),
  E('relativity', "Q: What did Einstein's relativity show?\nA: Space and time are linked into a single fabric, and gravity is the curvature of that fabric by mass. Time runs slower near massive objects and for fast-moving observers."),
  E('quantum', "Q: What is quantum mechanics?\nA: The physics of the very small, where particles behave like waves, observations affect outcomes, and only probabilities can be predicted. Underpins chemistry, electronics, and lasers."),
  E('entropy', "Q: What is entropy?\nA: A measure of disorder in a system. The second law of thermodynamics says isolated systems tend toward higher entropy — the arrow of time."),
  E('photosynth-vs-respiration', "Q: How are photosynthesis and respiration related?\nA: They're complementary. Photosynthesis takes in CO2 and water, releasing oxygen and storing energy in sugars. Respiration burns those sugars with oxygen, releasing CO2 and water."),
  E('cells', "Q: What is a cell?\nA: The smallest structural and functional unit of life. Bacteria and archaea are single-celled; plants and animals are multicellular. Every cell has a membrane, genetic material, and ribosomes."),
  E('plate-tectonics', "Q: What is plate tectonics?\nA: The theory that Earth's outer shell is broken into slowly moving plates. Their interactions cause earthquakes, volcanoes, and mountain ranges where they collide or pull apart."),
  E('greenhouse', "Q: What is the greenhouse effect?\nA: Gases like CO2, methane, and water vapor in the atmosphere trap infrared radiation from Earth's surface, warming the planet. Without it Earth would freeze; with too much, it warms beyond what ecosystems handle."),
  E('water-cycle', "Q: What is the water cycle?\nA: The continuous movement of water: evaporation from oceans and lakes, condensation into clouds, precipitation as rain or snow, runoff and groundwater flow back to the sea."),
  E('immune', "Q: How does the immune system work?\nA: Innate defenses (skin, mucus, inflammation) act fast. Adaptive immunity uses B-cells to make antibodies and T-cells to kill infected cells, and remembers pathogens so the next encounter is faster."),
  E('vaccines', "Q: How do vaccines work?\nA: They expose the immune system to a harmless piece or weakened form of a pathogen so it builds memory cells. When the real pathogen arrives, the response is fast and strong."),
  E('antibiotics', "Q: How do antibiotics work?\nA: They kill bacteria or stop them from reproducing — by disrupting cell walls, proteins, or DNA replication. They don't work against viruses, and overuse breeds resistance."),

  // Math
  E('pi', "Q: What is pi?\nA: The ratio of a circle's circumference to its diameter — about 3.14159. It's irrational (its decimal expansion never repeats) and appears throughout geometry and physics."),
  E('prime-numbers', "Q: What is a prime number?\nA: A whole number greater than 1 with no positive divisors other than 1 and itself. The primes are 2, 3, 5, 7, 11, 13, 17, … There are infinitely many."),
  E('zero', "Q: Why is zero important?\nA: It's the additive identity (x + 0 = x), a placeholder that makes positional notation work, and the foundation for negative numbers, calculus, and computer arithmetic."),
  E('infinity', "Q: Is infinity a number?\nA: Not in the usual sense — it's a concept. Different infinities have different sizes: the integers and the rationals are 'countably' infinite; the reals are uncountably larger (Cantor)."),
  E('probability', "Q: What is probability?\nA: A number from 0 to 1 measuring how likely an outcome is. 0 means impossible, 1 means certain. Independent events multiply: rolling two sixes is 1/6 × 1/6 = 1/36."),
  E('statistics-mean', "Q: What's the difference between mean, median, and mode?\nA: Mean is the average. Median is the middle value when sorted. Mode is the most common value. Median resists outliers; mean does not."),
  E('logarithm', "Q: What is a logarithm?\nA: The inverse of exponentiation. log_b(x) is the power you raise b to in order to get x. Logs turn multiplication into addition, which is why slide rules worked."),

  // History
  E('agricultural-revolution', "Q: What was the Agricultural Revolution?\nA: The shift from hunting-gathering to farming roughly 12,000 years ago. It enabled permanent settlements, surplus food, and the rise of civilizations — but also new diseases and inequality."),
  E('printing-press', "Q: Why did the printing press matter?\nA: Gutenberg's movable-type press (c. 1440) made books cheap and standardized. It fueled the Reformation, the Scientific Revolution, and the spread of literacy across Europe."),
  E('industrial-revolution', "Q: What was the Industrial Revolution?\nA: The shift to machine production and fossil fuels starting in late-18th-century Britain. Steam engines, textile mills, and railways transformed economies, cities, and labor — and began the climate crisis."),
  E('world-wars', "Q: What were the World Wars?\nA: Two global conflicts (1914–1918 and 1939–1945) that reshaped borders, accelerated technology (radar, computers, nuclear weapons), ended European empires, and led to the United Nations."),
  E('cold-war', "Q: What was the Cold War?\nA: The geopolitical standoff between the US-led West and Soviet-led East from roughly 1947 to 1991 — proxy wars, an arms race, and the space race, but no direct major-power combat."),
  E('moon-landing', "Q: When did humans first land on the Moon?\nA: July 20, 1969. NASA's Apollo 11 mission — Neil Armstrong and Buzz Aldrin walked on the surface while Michael Collins orbited in the command module."),
  E('internet-origins', "Q: How did the Internet start?\nA: From ARPANET, a US Defense Department research network in 1969. TCP/IP made it interoperable in the 1980s. Tim Berners-Lee added the World Wide Web on top in 1989."),

  // Geography
  E('continents', "Q: How many continents are there?\nA: Most geographers count seven: Africa, Antarctica, Asia, Australia/Oceania, Europe, North America, South America. Some traditions count six, merging Europe and Asia into Eurasia."),
  E('largest-country', "Q: What is the largest country by area?\nA: Russia, at about 17 million square kilometers — spanning 11 time zones from Eastern Europe to the Pacific."),
  E('largest-ocean', "Q: What is the largest ocean?\nA: The Pacific. It covers about a third of Earth's surface — larger than all the continents combined."),
  E('tallest-mountain', "Q: What is the tallest mountain?\nA: From sea level: Mount Everest (8,849 m). From base to peak: Mauna Kea, most of which is underwater. From Earth's center: Chimborazo, because of the equatorial bulge."),
  E('longest-river', "Q: What is the longest river?\nA: Disputed, but usually the Nile or the Amazon, both around 6,500 km. The Amazon carries by far the most water."),
  E('deserts', "Q: What is the largest desert?\nA: Antarctica — deserts are defined by low precipitation, not heat. Among hot deserts, the Sahara is the largest."),

  // Technology
  E('internet', "Q: What is the Internet?\nA: A global network of networks using common protocols (TCP/IP, HTTP). It moves packets between billions of devices and hosts services from email to streaming to the Web."),
  E('web-vs-internet', "Q: What's the difference between the Web and the Internet?\nA: The Internet is the underlying network. The Web is one service running on it — pages and links accessed via HTTP and browsers. Email, FTP, and games are other Internet services."),
  E('http-https', "Q: What's the difference between HTTP and HTTPS?\nA: HTTPS is HTTP wrapped in TLS — encrypted, authenticated by a certificate, integrity-checked. HTTP sends data in plain text. Use HTTPS for anything that isn't strictly public."),
  E('dns', "Q: What is DNS?\nA: The Domain Name System — a distributed directory translating names like example.com into the IP addresses computers actually use. Your computer asks a resolver, which traverses the system to find the answer."),
  E('cloud', "Q: What is 'the cloud'?\nA: Other people's computers, accessed over the Internet. Compute, storage, and services delivered on demand instead of running on your own hardware."),
  E('ai-vs-ml', "Q: What's the difference between AI and machine learning?\nA: AI is the broader goal of making machines do tasks that look intelligent. Machine learning is one approach: letting systems learn patterns from data instead of being explicitly programmed."),
  E('llm', "Q: What is a large language model?\nA: A neural network trained on huge text corpora to predict the next token given context. With enough scale and training, it produces fluent text and can be steered with prompts."),
  E('encryption', "Q: What is encryption?\nA: Scrambling data with a key so only someone with the right key can read it. Symmetric encryption uses one shared key; public-key encryption uses a public and private pair."),
  E('open-source', "Q: What is open source?\nA: Software whose source code is freely available to read, modify, and redistribute. Examples: Linux, Python, Wikipedia. Open licenses spell out the terms (MIT, GPL, Apache, etc.)."),
  E('garbage-collection', "Q: What is garbage collection in programming?\nA: Automatic memory management: the runtime tracks which objects are still reachable and frees the rest. Used in Java, Python, JavaScript. Avoids manual malloc/free at the cost of pauses."),

  // Computer concepts
  E('binary', "Q: Why do computers use binary?\nA: Because electronic components are reliable at distinguishing two states — on/off, high/low voltage. Every other representation (text, image, audio) is ultimately encoded as sequences of bits."),
  E('algorithm', "Q: What is an algorithm?\nA: A precise, finite procedure for solving a problem or computing a result. Sorting, searching, routing, and ranking all use algorithms. Different algorithms for the same task can vary wildly in speed."),
  E('big-o', "Q: What does Big-O notation describe?\nA: How an algorithm's running time or memory grows with input size, ignoring constants. O(n) scales linearly; O(n²) is quadratic; O(log n) barely grows. Used to compare algorithms at scale."),
  E('cache', "Q: What is a cache?\nA: A small, fast store for results you expect to need again. CPUs cache memory accesses; browsers cache pages; APIs cache responses. Invalidation — knowing when cached data is stale — is the hard part."),
  E('compiler-interpreter', "Q: What's the difference between a compiler and an interpreter?\nA: A compiler translates source code to machine code ahead of time (C, Rust, Go). An interpreter executes source code on the fly (Python, JavaScript). Modern systems blur the line with JIT compilation."),

  // Everyday how-to
  E('learn-faster', "Q: How can I learn something faster?\nA: Active recall beats rereading: quiz yourself. Space the practice over days. Interleave related topics. Explain the idea to someone else. Build something with the new knowledge."),
  E('better-sleep', "Q: How do I sleep better?\nA: Keep a consistent schedule. Cool, dark, quiet room. Avoid caffeine after noon and screens for the last hour. Get sunlight in the morning. Don't drink alcohol within three hours of bed."),
  E('reduce-stress', "Q: How can I reduce stress?\nA: Move your body daily. Sleep well. Cut what you can from the input pile. Talk it through with someone. For acute moments, slow your exhale — it triggers the parasympathetic response."),
  E('save-money', "Q: How do I save money?\nA: Track where it goes for a month — you'll find leaks. Automate savings before you see the rest. Pay off high-interest debt aggressively. Increase income matters more than penny-pinching over time."),
  E('start-running', "Q: How do I start running?\nA: Begin with walk-runs: walk five minutes, run one, repeat for thirty. Add a minute of running each week. Cushioned shoes that fit, soft surfaces if your joints complain. Pace should let you talk."),
  E('public-speaking', "Q: How do I get better at public speaking?\nA: Practice out loud, not silently. Record yourself once — it cures bad habits fast. Know your first sentence cold. Slow down deliberately. Look at one person at a time, not the crowd."),
  E('write-better', "Q: How do I write better?\nA: Write more, edit harder. Cut every word that doesn't earn its place. Read your sentences aloud — you'll hear what's broken. Imitate writers you admire until your own voice emerges."),
  E('decision-making', "Q: How do I make better decisions?\nA: Define the actual decision before debating it. List the realistic options, not just two. Imagine each one a year out. For reversible calls, decide fast. For irreversible ones, slow down and gather more."),
  E('focus-deep-work', "Q: How can I focus better?\nA: Block one specific task to a chunk of time. Put the phone in another room. Close every tab unrelated to the work. Expect the first ten minutes to feel resistant — they always do."),

  // Time/practical
  E('time-zones', "Q: How do time zones work?\nA: The world is divided into roughly 24 longitudinal zones, each one hour from the next. UTC is the reference. Daylight saving shifts some zones an hour in summer. The International Date Line jogs the boundary."),
  E('leap-year', "Q: Why do we have leap years?\nA: Earth orbits the Sun in about 365.2422 days. Adding one day every four years almost fixes the drift; skipping century years not divisible by 400 fixes the rest. So 2000 was a leap year, 1900 wasn't."),
  E('seasons', "Q: Why do we have seasons?\nA: Earth's axis is tilted about 23.5°. As we orbit the Sun, the hemisphere tilted toward it gets longer days and more direct sunlight — that's summer. Six months later it's tilted away — winter."),
  E('weather-vs-climate', "Q: What's the difference between weather and climate?\nA: Weather is what's happening now and in the next few days. Climate is the long-term pattern of weather in a place — typical temperature, rainfall, and how those are shifting over decades."),

  // Health basics
  E('hydration', "Q: How much water should I drink?\nA: Rough rule: drink when you're thirsty and pee pale yellow. Hot weather and exercise raise the number. There's no magical 'eight glasses' — bodies vary."),
  E('exercise-amount', "Q: How much exercise is enough?\nA: WHO suggests 150 minutes of moderate or 75 minutes of vigorous activity per week, plus two strength sessions. Walking counts. Anything is better than nothing, and consistency beats intensity."),
  E('mental-health', "Q: When should I see someone about my mental health?\nA: If symptoms last more than two weeks, interfere with work or relationships, or include thoughts of self-harm — talk to a professional. Earlier is better than later. Therapy isn't only for crises."),
  E('caffeine', "Q: Is caffeine bad for you?\nA: In moderation, no — around 400 mg a day is fine for most adults (about four cups of coffee). It improves alertness and short-term focus. It can disrupt sleep if used after early afternoon and is habit-forming."),

  // Cooking basics
  E('boil-egg', "Q: How do I boil an egg?\nA: Cover eggs with cold water by an inch, bring to a boil, remove from heat, cover. Soft yolk: 4–5 minutes. Medium: 7. Hard: 10–12. Ice bath after to stop cooking and make peeling easier."),
  E('rice', "Q: How do I cook rice?\nA: One part rice to about 1.5–2 parts water depending on the variety. Bring to a boil, cover, reduce to low, simmer 15–20 minutes, rest off heat 5 minutes. Don't lift the lid while cooking."),
  E('seasoning', "Q: How do I season food well?\nA: Salt early and taste constantly. Acid (lemon, vinegar) brightens; fat (butter, oil) carries flavor; heat (pepper, chili) adds dimension; sweetness balances. Adjust at the end."),
  E('pasta', "Q: How do I cook pasta properly?\nA: Lots of water, well salted. Cook to one minute shy of the package time. Reserve some starchy cooking water before draining — it helps sauce cling. Don't rinse."),

  // Emotional/social
  E('friendship', "Q: How do I make friends as an adult?\nA: Repeated unplanned contact is the secret ingredient — pick a regular activity (class, hobby, gym). Be the one who follows up. Friendships need maintenance like any relationship."),
  E('grief', "Q: How do I deal with grief?\nA: Let it be heavy. Don't rush yourself. Sleep, food, and a few people who can hear it without trying to fix it — those are the load-bearing supports. Professional help is worth it if it stays crushing."),
  E('apology', "Q: How do I apologize well?\nA: Name what you did, not just 'sorry you felt that way.' Acknowledge the impact. Say what you'll do differently. Don't bury it in excuses. Then let them respond — don't demand quick forgiveness."),
  E('disagreement', "Q: How do I disagree without fighting?\nA: Get the other side's view back to them accurately first. Argue against the strongest version, not the weakest. Stay on the issue, not the person. Some conversations need a break before they need a resolution."),

  // Productivity
  E('procrastination', "Q: Why do I procrastinate?\nA: Usually emotional avoidance, not laziness — the task feels threatening, boring, or unclear. Make the first step embarrassingly small. Set a five-minute timer. Starting beats planning."),
  E('to-do-lists', "Q: How do I keep a useful to-do list?\nA: Three items maximum for today. Each one should be a single physical action. Carry over what you don't finish. Review weekly and ruthlessly remove what doesn't matter."),
  E('habits', "Q: How do I build a habit?\nA: Tie it to an existing routine (after coffee, before brushing teeth). Make it tiny enough to do on bad days. Track it visibly. Don't miss twice in a row. Stop expecting motivation."),

  // Philosophy / ideas
  E('meaning-of-life', "Q: What is the meaning of life?\nA: There's no single answer — humans have argued it for millennia. Most useful frame: meaning comes from what you commit to, who you care about, and the work you put in. Not given to you, made by you."),
  E('free-will', "Q: Do we have free will?\nA: Philosophers and scientists genuinely disagree. Hard determinists say no; libertarians say yes; compatibilists say it depends what 'free' means. In practice we live as if we have it — and the systems we build assume it."),
  E('consciousness', "Q: What is consciousness?\nA: The subjective experience of being you — sensing, feeling, thinking. Why physical processes in a brain produce inner experience is called 'the hard problem' and isn't solved."),
  E('ethics', "Q: How do I know what's right?\nA: Major ethical frameworks: consequences (does it help or harm), duties (universal rules), virtues (what would a good person do), relationships (do you owe these specific people). Most people use all four depending on the situation."),

  // Arts and culture
  E('music', "Q: Why does music affect us emotionally?\nA: Music engages reward, memory, motor, and emotion circuits all at once. Patterns of tension and release mirror feelings. Cultural context shapes which patterns we find sad, exciting, or comforting."),
  E('great-novel', "Q: What makes a novel great?\nA: A character you can't forget. Sentences that earn their place. A world that feels lived-in. A truth that surfaces only because of the story. Reasonable people will disagree on every example."),
  E('film', "Q: What makes a film good?\nA: A clear point of view from the director. Specific, surprising choices. Sound and image working together, not just illustrating dialogue. A scene you'll replay in your head a week later."),

  // Career and work
  E('job-interview', "Q: How do I prepare for a job interview?\nA: Research the company and the people interviewing you. Have three or four stories ready that show concrete impact. Prepare thoughtful questions for them. Practice out loud, not silently. Sleep, water, a snack."),
  E('feedback', "Q: How do I give good feedback?\nA: Be specific (what, when, the impact). Aim it at behavior, not character. Make it timely — within a few days, not at review time. Lead with the why, not the rule. Make it the start of a conversation, not the end."),
  E('quitting', "Q: When should I quit my job?\nA: When the cost of staying outweighs the cost of leaving — financially, mentally, or in terms of opportunity. Don't burn bridges. Have something lined up if you can. 'You'll know' is usually true but not always — sometimes you have to decide before the gut catches up."),
  E('networking', "Q: I hate networking — how do I do it anyway?\nA: Reframe it: you're not selling, you're learning what other people do. Ask better questions, listen more than you talk, follow up with one specific thing you noticed. Smaller is fine — depth over breadth."),
];

const DIALOGUE_EXTRA = [
  E('long pause', "Q: are you there are you still there hello?\nA: Yes — I'm here. What were you thinking?"),
  E('confusion', "Q: I don't understand can you explain that again say it differently\nA: Sure. Tell me which part lost you and I'll come at it from a different angle."),
  E('compliment back', "Q: you're smart you're helpful you're amazing impressive\nA: Thanks. Most of that is the people who built me and the data I've been given — I just rearrange it usefully."),
  E('frustration', "Q: this is frustrating I'm stuck I'm angry I'm upset\nA: That's fair. Want to step back and describe what you're actually trying to get to? Sometimes restating the goal helps more than another attempt at the obstacle."),
  E('topic change', "Q: anyway moving on next topic something else\nA: Got it. What's next?"),
  E('let me think', "Q: let me think give me a minute hold on one moment\nA: Take your time. I'll be right here."),
  E('agree', "Q: that makes sense you're right that's a good point I agree\nA: Glad it lands. Want to take the next step from there?"),
  E('disagreement gently', "Q: I don't think that's right I disagree I'm not sure about that\nA: Fair — push back. What's the part that feels off to me?"),
  E('encouragement', "Q: I'm doubting myself I don't know if I can do this I'm not sure\nA: Doubt is data, not a verdict. Break the next step small enough that you don't have to feel ready — just do it."),
  E('boredom', "Q: I'm bored entertain me say something interesting\nA: Bored is a starting line for the brain. Tell me what you're curious about — even a small thing — and we can pull a thread from there."),
];

const HELP = [
  E('how do I use you', "Q: how do I use you how do I use this how does this work usage\nA: Type a question. I retrieve the most relevant piece of what I know and answer with it. Add your own knowledge in the Knowledge tab and I'll use that too. Switch modes in the Training tab for different behaviors."),
  E('what languages', "Q: what languages do you speak do you speak Spanish French German Chinese\nA: My training is mostly English. I can recognize words from other languages but my answers will be in English unless you train me on more material in those languages."),
  E('private', "Q: is this private will anyone see what I tell you can others read this\nA: Everything stays in your browser. The chunks you add are stored locally in IndexedDB; nothing leaves your device unless you explicitly send a query to NVIDIA or scrape a URL with Firecrawl, and even then only those two services see what you send."),
  E('cost', "Q: how much does this cost is this free is it paid\nA: The app itself is free. Optional plug-ins cost only what those services charge — NVIDIA's build platform offers a free tier; Firecrawl has a small free plan."),
  E('source', "Q: are you open source can I see the code where is the code\nA: Yes — the source is at github.com/the123maiac/agent-forge. Everything from the UI to the retrieval to the neural-net training is in there."),
];

/* The full base corpus exposed to the app. */
export const BASE_CHUNKS = [...KNOWLEDGE, ...DIALOGUE_EXTRA, ...HELP];
