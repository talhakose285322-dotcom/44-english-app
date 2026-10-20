// Fixed answers for the dictionary sources, so dictionary tests never reach the real services.
// approach: English Wiktionary (a verb sense with examples and a Turkish translation, a noun sense), Turkish
// Wiktionary (Ad: yaklaşım, Eylem: yaklaşmak). dictionaryapi.dev answers "not found", Datamuse has nothing, and
// MyMemory returns "TR: <text>" so automatic sentence translations are easy to recognise.
const EN = {
  approach: `==English==
===Verb===
{{en-verb}}
# To come or go near, in place or time.
#: {{ux|en|She approached the door cautiously.}}
#: {{ux|en|We were approached by a stranger.}}

====Translations====
{{trans-top|1. to come or go near}}
* Turkish: {{t+|tr|yaklaşmak}}
{{trans-bottom}}

===Noun===
{{en-noun}}
# The act of drawing near.
#: {{ux|en|The approach of winter was felt.}}
`
};
const TR = {
  approach: `==İngilizce==
===Ad===
{{en-ad}}
# [[yaklaşım]]

===Eylem===
# [[yaklaşmak]]
`
};
const page = u => new URL(u).searchParams.get('page');
const wiki = pages => u => {
  const p = page(u), t = pages[p];
  return {body: t ? {parse: {title: p, wikitext: t}} : {error: {code: 'missingtitle', info: "The page you specified doesn't exist."}}};
};

export const mymemory = [];
export const dictionaryRoutes = [
  {match: u => u.startsWith('https://en.wiktionary.org/w/api.php'), respond: wiki(EN)},
  {match: u => u.startsWith('https://tr.wiktionary.org/w/api.php'), respond: wiki(TR)},
  {match: u => u.startsWith('https://api.dictionaryapi.dev/'), respond: () => ({status: 404, body: {title: 'No Definitions Found'}})},
  {match: u => u.startsWith('https://api.datamuse.com/'), respond: () => ({body: []})},
  {match: u => u.startsWith('https://api.mymemory.translated.net/'), respond: u => {
    const q = new URL(u).searchParams.get('q'); mymemory.push(q);
    return {body: {responseData: {translatedText: 'TR: ' + q, match: 1}, responseStatus: 200, matches: []}};
  }}
];
