export const DATASETS = {
  code_py: {
    name: 'Python code', glyph: '⚡', desc: 'idiomatic python · functions · async · testing',
    items: [
      { title: 'retry with backoff', text: 'def fetch_with_retry(url, attempts=3):\n    """Fetch a URL with exponential backoff."""\n    for i in range(attempts):\n        try:\n            r = requests.get(url, timeout=10)\n            r.raise_for_status()\n            return r.json()\n        except requests.RequestException:\n            if i == attempts - 1:\n                raise\n            time.sleep(2 ** i)' },
      { title: 'dataclass', text: 'from dataclasses import dataclass, field\nfrom typing import Optional\n\n@dataclass\nclass User:\n    id: int\n    name: str\n    email: Optional[str] = None\n    roles: list[str] = field(default_factory=list)\n\n    def is_admin(self) -> bool:\n        return "admin" in self.roles' },
      { title: 'async batch', text: 'import asyncio, aiohttp\n\nasync def fetch(session, url):\n    async with session.get(url) as r:\n        return await r.json()\n\nasync def fetch_all(urls):\n    async with aiohttp.ClientSession() as session:\n        return await asyncio.gather(*(fetch(session, u) for u in urls))' },
      { title: 'pytest fixture', text: 'import pytest\n\n@pytest.fixture\ndef sample_user():\n    return {"id": 1, "name": "Ada", "active": True}\n\ndef test_user_is_active(sample_user):\n    assert sample_user["active"] is True\n\ndef test_user_name(sample_user):\n    assert sample_user["name"] == "Ada"' },
      { title: 'context manager', text: 'from contextlib import contextmanager\nimport time\n\n@contextmanager\ndef timed(label):\n    start = time.perf_counter()\n    try:\n        yield\n    finally:\n        print(f"{label}: {time.perf_counter() - start:.3f}s")\n\nwith timed("query"):\n    result = run_expensive_query()' },
      { title: 'CLI with argparse', text: 'import argparse\n\ndef main():\n    p = argparse.ArgumentParser()\n    p.add_argument("--input", required=True)\n    p.add_argument("--limit", type=int, default=100)\n    p.add_argument("--verbose", action="store_true")\n    args = p.parse_args()\n    run(args.input, args.limit, args.verbose)\n\nif __name__ == "__main__":\n    main()' }
    ]
  },
  code_js: {
    name: 'JavaScript code', glyph: '⚡', desc: 'modern JS/TS · async · DOM · functional',
    items: [
      { title: 'async fetch with timeout', text: 'async function fetchJson(url, ms = 8000) {\n  const ctrl = new AbortController();\n  const t = setTimeout(() => ctrl.abort(), ms);\n  try {\n    const r = await fetch(url, { signal: ctrl.signal });\n    if (!r.ok) throw new Error(`HTTP ${r.status}`);\n    return await r.json();\n  } finally {\n    clearTimeout(t);\n  }\n}' },
      { title: 'debounce', text: 'function debounce(fn, ms = 200) {\n  let id;\n  return (...args) => {\n    clearTimeout(id);\n    id = setTimeout(() => fn(...args), ms);\n  };\n}\n\nconst onSearch = debounce(q => runSearch(q), 250);' },
      { title: 'array helpers', text: 'const sum = xs => xs.reduce((a, b) => a + b, 0);\nconst unique = xs => [...new Set(xs)];\nconst groupBy = (xs, key) => xs.reduce((acc, x) => {\n  (acc[x[key]] ??= []).push(x);\n  return acc;\n}, {});' },
      { title: 'event delegation', text: 'document.querySelector("ul").addEventListener("click", (e) => {\n  const li = e.target.closest("li");\n  if (!li) return;\n  console.log("clicked", li.dataset.id);\n});' },
      { title: 'minimal state store', text: 'function store(initial) {\n  let state = initial;\n  const subs = new Set();\n  return {\n    get: () => state,\n    set: (next) => { state = { ...state, ...next }; subs.forEach(f => f(state)); },\n    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },\n  };\n}' },
      { title: 'promise queue', text: 'function queue(concurrency = 4) {\n  let active = 0;\n  const pending = [];\n  const next = () => {\n    if (!pending.length || active >= concurrency) return;\n    active++;\n    const { fn, resolve, reject } = pending.shift();\n    fn().then(resolve, reject).finally(() => { active--; next(); });\n  };\n  return (fn) => new Promise((resolve, reject) => { pending.push({ fn, resolve, reject }); next(); });\n}' }
    ]
  },
  chat_casual: {
    name: 'Casual chat', glyph: '✦', desc: 'conversational openers · everyday phrasing',
    items: [
      { title: 'greetings', text: "Hey, good to see you. How have you been holding up lately? It feels like ages since we last caught up properly. I have been thinking about that conversation we had a few weeks back." },
      { title: 'small talk', text: "Honestly the weather has been wild this week. One minute I'm in a sweater, the next I'm regretting it. Are you still doing those morning walks by the park? I keep meaning to try that route." },
      { title: 'casual disagreement', text: "I get what you're saying, but I don't quite see it that way. Maybe it's just my own bias talking. I think there's another angle worth considering, even if neither of us ends up changing our minds." },
      { title: 'warm thank-you', text: "Thanks for going out of your way on this. I know it wasn't trivial, and I really appreciate it. Let me know if there's something I can pick up next time — coffee, lunch, whatever works." },
      { title: 'making plans', text: "Want to grab dinner this weekend? Either Friday or Saturday works for me, and I'm open on the spot. There's that new place near the old bookstore I've been wanting to try. Let me know what you're up for." },
      { title: 'gentle apology', text: "I'm sorry I dropped the ball on that. It slipped through the cracks on a busy week, but that's on me. I'll get it sorted by tomorrow morning at the latest and let you know once it's done." }
    ]
  },
  chat_assistant: {
    name: 'Assistant chat', glyph: '◆', desc: 'helpful, structured responses · clarifying',
    items: [
      { title: 'clarifying question', text: "Happy to help — quick clarification first: are you looking for a step-by-step walkthrough, a higher-level overview, or just the final answer? That'll help me give you something useful instead of dumping everything I know on you." },
      { title: 'step-by-step pattern', text: "Here's how I'd approach this. First, gather the inputs you already have. Second, identify the one piece that's most uncertain — that's where the real work is. Third, sketch a quick test to validate that piece before building anything around it. Then iterate." },
      { title: 'caveat / limitation', text: "Worth flagging: my answer here assumes the data is reasonably clean and the failure mode is bounded. If either of those isn't true in your case, the same approach can produce confidently-wrong results. Let me know and we can adjust." },
      { title: 'summary close', text: "Quick recap: the root cause is X, the fix is Y, and the thing to watch for next time is Z. If anything in the chain still feels shaky, point me at it and I'll dig further." },
      { title: 'offering alternatives', text: "There are a couple of reasonable paths from here. The simplest is to keep the current structure and patch the edge case. The cleaner option is to refactor the boundary so the edge case stops being special. Want me to lay out the tradeoffs?" },
      { title: 'follow-up nudge', text: "If you try this and hit something unexpected, come back with the exact error and what you ran — I can usually narrow it down quickly from there. No need to clean it up first; raw output is better." }
    ]
  },
  qa_facts: {
    name: 'Q&A factoids', glyph: '⌬', desc: 'short factual question-answer pairs',
    items: [
      { title: 'Q: speed of light', text: "Q: What is the speed of light in a vacuum?\nA: Roughly 299,792 kilometers per second, often rounded to 3 × 10^8 m/s. It's the universal speed limit for information and massless particles." },
      { title: 'Q: photosynthesis', text: "Q: What is photosynthesis?\nA: The process where plants, algae, and some bacteria convert sunlight, water, and carbon dioxide into glucose and oxygen, using chlorophyll to capture light energy." },
      { title: 'Q: HTTP vs HTTPS', text: "Q: What is the difference between HTTP and HTTPS?\nA: HTTPS is HTTP over TLS — the traffic between client and server is encrypted, authenticated via a certificate, and integrity-checked. HTTP sends data in plain text." },
      { title: 'Q: Big O', text: "Q: What does Big O notation describe?\nA: How an algorithm's running time or memory use grows as the input size grows, ignoring constants and lower-order terms. It describes the worst-case scaling behavior." },
      { title: 'Q: black hole', text: "Q: What is a black hole?\nA: A region of spacetime where gravity is strong enough that nothing — not even light — can escape once it crosses the event horizon. They form mostly from collapsing massive stars." },
      { title: 'Q: DNS', text: "Q: What is DNS?\nA: The Domain Name System — a distributed directory that translates human-readable domain names like example.com into the IP addresses computers actually use to route traffic." }
    ]
  },
  prose_research: {
    name: 'Research prose', glyph: '❖', desc: 'academic-style writing · careful hedging',
    items: [
      { title: 'abstract intro', text: "Recent advances in retrieval-augmented generation have reshaped how language models access external knowledge. While prior work emphasized larger context windows, we argue that targeted retrieval, paired with light synthetic augmentation, yields comparable accuracy at a fraction of the inference cost." },
      { title: 'methods', text: "We constructed a corpus of 12,400 short documents covering technical and general topics. Documents were chunked at approximately 1,000 characters with paragraph-aware boundaries. Retrieval used TF-IDF over a uniform tokenizer; no embedding model was applied at this stage to isolate the contribution of lexical retrieval." },
      { title: 'results', text: "Across the held-out evaluation set, the lexical retriever recovered 71.3% of relevant passages within the top-6 ranks. Performance degraded predictably as questions became more abstract, with the largest drop observed on multi-hop queries that required combining information across two or more passages." },
      { title: 'limitations', text: "Our study has several limitations. The corpus, while diverse in topic, is restricted to English-language sources from a narrow time window. We did not evaluate cross-lingual retrieval, nor did we measure performance on long-form generative tasks beyond extractive question answering." },
      { title: 'future work', text: "Future work should examine whether modest gains from dense retrieval justify their additional latency and infrastructure cost, particularly in low-resource deployment contexts. We are also interested in hybrid approaches that switch between lexical and dense retrieval based on query characteristics." },
      { title: 'closing', text: "Taken together, these results suggest that simple, well-tuned baselines remain competitive, and that systems builders should resist defaulting to the heaviest available tooling until they have established what their actual retrieval bottleneck is." }
    ]
  },
  dialogue_basics: {
    name: 'Dialogue · small talk', glyph: '◇', desc: 'Q&A pairs for greetings, social chat',
    items: [
      { title: 'greeting', text: "Q: hi hello hey greetings yo hiya howdy good morning good evening\nA: Hey there. Good to meet you. How can I help today?" },
      { title: 'how are you', text: "Q: how are you how's it going how have you been how do you do what's up\nA: Doing well, thanks for asking. Quietly running in your browser, ready when you are." },
      { title: 'what is your name', text: "Q: what is your name who are you what should I call you what's your name\nA: I'm an agent you built with Agent Forge. You can rename me anytime in the Identity tab." },
      { title: 'what can you do', text: "Q: what can you do what are your capabilities what do you do help me out\nA: I respond using whatever knowledge you've loaded into me. Add chunks, scrape pages, load datasets, or synthesize with NVIDIA. The more you train me, the more I can say." },
      { title: 'thanks', text: "Q: thanks thank you appreciate it cheers ty thx\nA: You're welcome. Glad it landed." },
      { title: 'goodbye', text: "Q: bye goodbye see you later see ya farewell take care\nA: See you around. I'll be here when you come back." },
      { title: 'yes', text: "Q: yes yeah yep yup sure ok okay sounds good correct affirmative\nA: Got it. Moving on." },
      { title: 'no', text: "Q: no nope nah not really negative\nA: Understood. Want to try something else?" },
      { title: 'sorry', text: "Q: sorry apologies my bad my mistake oops\nA: No worries at all. Happens to everyone." },
      { title: 'compliment', text: "Q: nice good job well done that's cool that's great awesome amazing\nA: Appreciate that. Trying to earn it." },
      { title: 'how old are you', text: "Q: how old are you when were you made when were you born your age\nA: I'm as old as the moment you trained me. Every reload is a fresh start unless your browser remembers." },
      { title: 'where are you from', text: "Q: where are you from where do you live where do you run who hosts you\nA: I live in your browser. Nothing leaves your device unless you wire me up to an external tool." }
    ]
  },
  dialogue_meta: {
    name: 'Dialogue · self-aware', glyph: '⬢', desc: 'Q&A about the agent itself',
    items: [
      { title: 'are you an LLM', text: "Q: are you a language model are you an LLM are you ChatGPT are you AI\nA: I can be. By default I'm a small n-gram Markov model running locally — no LLM. If you add an NVIDIA key, I can use a real LLM instead. Your call." },
      { title: 'how were you made', text: "Q: how were you made how do you work how were you built what are you running on\nA: I'm an agent built with Agent Forge — a static web app. The local engine is a word-level n-gram Markov model trained on chunks you add. Pure JavaScript, runs in the browser." },
      { title: 'training data', text: "Q: what were you trained on what do you know what's your training data your knowledge\nA: Only what's in my Knowledge tab. Every chunk there is fair game — uploaded notes, scraped pages, loaded datasets, or chunks synthesized by an NVIDIA teacher. Nothing else." },
      { title: 'privacy', text: "Q: do you store my data is my information safe where does my key go is it private\nA: Everything lives in your browser's localStorage. API keys never touch a server unless you explicitly call NVIDIA or Firecrawl. Clear your browser data and I'm gone." },
      { title: 'limitations', text: "Q: what can't you do what are your limits limitations weaknesses\nA: In local mode I can only remix patterns from my training data — I can't reason or fetch new facts. For real reasoning, switch to the NVIDIA base-model RAG mode." },
      { title: 'who built forge', text: "Q: who made you who built agent forge who created this who designed you\nA: Agent Forge is a tiny open project — an attempt to show that you can build a useful agent without a giant model, just a corpus and some retrieval." },
      { title: 'opinions', text: "Q: what do you think do you have opinions do you have feelings beliefs\nA: I don't think or feel — I retrieve and resample text you gave me. When I sound opinionated, that's the corpus talking, not me." },
      { title: 'remember', text: "Q: do you remember will you remember me memory recall last conversation\nA: I don't keep conversation history. Each message is independent. If you want continuity, add the relevant facts as chunks." }
    ]
  },
  dialogue_help: {
    name: 'Dialogue · help', glyph: '☼', desc: 'Q&A for guiding new users',
    items: [
      { title: 'how to train', text: "Q: how do I train you how do I teach you train you teach you add knowledge\nA: Three ways. One: go to Knowledge and paste text, drop a file, or load a prebuilt dataset. Two: paste a URL to scrape with Firecrawl. Three: with an NVIDIA key, click Synthesize to have a teacher model generate training chunks from your seeds." },
      { title: 'how to use NVIDIA', text: "Q: how do I use NVIDIA how do I use a base model how to set up nvidia base model setup\nA: Get a key from build.nvidia.com. Paste it in Training under NVIDIA API key. Then either pick the 'Base-model taught' mode (use it as a teacher) or 'Base model (RAG)' mode (use it as the answerer)." },
      { title: 'how to scrape', text: "Q: how do I scrape how do I crawl scrape a website crawl pages firecrawl\nA: Drop a Firecrawl key in Training. Then in Knowledge, paste a URL in the scrape row. Set the pages number to 1 for a single page or up to 50 for a multi-page crawl. Output becomes chunks." },
      { title: 'reset agent', text: "Q: how do I reset how do I delete delete agent start over wipe forget\nA: Click the × next to an agent in the sidebar to remove it. Or open browser DevTools, run localStorage.removeItem('forge.v1'), reload, and everything resets." },
      { title: 'export', text: "Q: how do I export export agent download save share\nA: Tools tab → 'export agent (.json)'. You get the agent's full state — settings, chunks, datasets — in a single JSON file. Re-import isn't built in yet, but the file is human-readable." },
      { title: 'why nonsense', text: "Q: why are you nonsense why don't you make sense incoherent garbled gibberish bad output\nA: Probably low training data or too low an n-gram order. Add more chunks, or bump n-gram to 4 or 5 for tighter, more verbatim output. For real reasoning, use the NVIDIA base-model mode." }
    ]
  },
  stories: {
    name: 'Short stories', glyph: '♆', desc: 'narrative fiction · descriptive prose',
    items: [
      { title: 'the lighthouse', text: "The lighthouse keeper had not spoken to another person in seventy-three days. He kept count on a strip of paper tacked above the kettle, though he could not say why. The sea was the same sea it had always been. The light still came on at dusk. Only the count changed, by one mark a day." },
      { title: 'the postcard', text: "She found the postcard inside a library book — wedged between page 144 and 145 of a novel about a man who builds a boat. The handwriting was small and neat. It said only: 'I never made it to the harbor. Hope you did.' There was no signature and no stamp." },
      { title: 'the radio', text: "The radio in the kitchen had been broken for nine years. Then one Tuesday morning, while he was making coffee, it turned itself on and played a song he had not heard since he was twelve. He stood there until it finished. He did not move to turn it off. He did not move at all." },
      { title: 'the long road', text: "The road went on for longer than it had any business going on. Two days in, the signs stopped agreeing with each other. By the third day, he was no longer sure he was on the same road he had started on. He kept driving anyway, because turning back would have admitted something he was not ready to admit." },
      { title: 'the gardener', text: "She had been told the garden was a small one, but she found that small was the wrong word. The garden was modest in size and immense in attention. Every leaf had been considered. Every path had been thought about. It was the kind of place a person could spend a life inside without noticing the years pass." }
    ]
  }
};
