import { parseInstagramMessageWebhook } from "../src/lib/webhooks/instagram-messages.ts";

let fails = 0;
const eq = (a,b,l) => { if (JSON.stringify(a)!==JSON.stringify(b)) { console.error("FAIL:", l, "->", JSON.stringify(a), "esperado", JSON.stringify(b)); fails++; } else console.log("ok  ", l); };

const payload = { object:"instagram", entry:[{ id:"17841400000000", time:1700000000, messaging:[
  { sender:{id:"111"}, recipient:{id:"17841400000000"}, timestamp:1700000000000, message:{ mid:"m1", text:"oi, quero!" } },
  { sender:{id:"17841400000000"}, recipient:{id:"111"}, timestamp:1700000001000, message:{ mid:"m2", text:"te respondi", attachments:[{type:"image"}] } },
  { sender:{id:"222"}, recipient:{id:"17841400000000"}, timestamp:1700000002000, message:{ text:"sem mid -- deve ser descartado" } }
]}]};

const r = parseInstagramMessageWebhook(payload);
eq(r.messages.length, 2, "2 mensagens validas (sem mid descartado)");
eq(r.messages[0].fromOwnAccount, false, "m1 eh INBOUND (fromOwnAccount=false)");
eq(r.messages[0].igMessageId, "m1", "mid preservado");
eq(r.messages[0].sentAt instanceof Date, true, "timestamp interpretado");
eq(r.messages[1].fromOwnAccount, true, "m2 eh OUTBOUND (fromOwnAccount=true)");
eq(r.messages[1].attachmentType, "image", "tipo de anexo lido");

// payload fora do formato => vazio, sem lancar
eq(parseInstagramMessageWebhook({object:"page"}).messages.length, 0, "object != instagram => vazio");
eq(parseInstagramMessageWebhook("lixo").messages.length, 0, "payload nao-objeto => vazio");
console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK");
process.exit(fails ? 1 : 0);
