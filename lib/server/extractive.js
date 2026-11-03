// Резюме без внешних сервисов: выбираем самые «весомые» предложения (частотный метод, как в TextRank-подходах).
const STOP = new Set(`и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это также который которые которая которого
the of and to a in is that it for as with was on be by this are at from or an have not but had they which you were his her all can has will one would there their what so up out if about who get when them its been more than into some time could do no other these then now only see two may like over such our him just also`.split(/\s+/));

const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => !STOP.has(w));

export function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}\d«"(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

export function summarize(text, length = 'medium') {
  const sents = splitSentences(text);
  const want = { short: 4, medium: 8, long: 16 }[length] || 8;
  if (sents.length <= want) return sents.length ? sents.map((s) => `- ${s}`).join('\n') : text.trim().slice(0, 1500);

  const tf = new Map();
  const toks = sents.map((s) => words(s));
  toks.forEach((ws) => ws.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1)));
  const scored = sents.map((s, i) => {
    const ws = toks[i];
    if (ws.length < 4) return { i, s, score: 0 };
    let sc = 0;
    for (const w of new Set(ws)) sc += tf.get(w) > 1 ? tf.get(w) : 0.2;
    sc = sc / Math.sqrt(ws.length);
    if (i < 3) sc *= 1.25; // начало документа обычно важнее
    if (s.length > 400) sc *= 0.6;
    return { i, s, score: sc };
  });
  const top = scored.sort((a, b) => b.score - a.score).slice(0, want).sort((a, b) => a.i - b.i);
  return top.map((t) => `- ${t.s}`).join('\n');
}
