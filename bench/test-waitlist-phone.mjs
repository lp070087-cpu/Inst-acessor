/** Pure unit tests for the launch waitlist Brazilian phone mask/normalizer. No network, no DB. */
import assert from 'node:assert/strict';

const phone = await import('@/lib/launch-waitlist/phone');
const { brazilianPhoneDigits, formatBrazilianPhone, maskBrazilianPhone, brazilianPhoneProblem, toBrazilianE164, applyBrazilianPhoneEdit, BRAZILIAN_PHONE_MESSAGES } = phone;
const SERVER_REGEX = /^\+[1-9]\d{7,14}$/; // mirrors launchSignupSchema.whatsapp
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`ok ${name}`); }

check('progressive mobile typing', () => {
  const expected = ['(1', '(11', '(11) 9', '(11) 99', '(11) 999', '(11) 9999', '(11) 9999-9', '(11) 9999-98', '(11) 9999-988', '(11) 9999-9888', '(11) 99999-8888'];
  const typed = '11999998888';
  let value = '';
  for (let i = 0; i < typed.length; i++) { value = maskBrazilianPhone(value + typed[i]); assert.equal(value, expected[i], `after ${i + 1} digits`); }
});
check('landline 10 digits', () => { assert.equal(formatBrazilianPhone('1133334444'), '(11) 3333-4444'); assert.equal(brazilianPhoneProblem('1133334444'), null); });
check('mobile 11 digits', () => { assert.equal(formatBrazilianPhone('21987654321'), '(21) 98765-4321'); assert.equal(brazilianPhoneProblem('21987654321'), null); });
check('extra digits are capped at 11', () => assert.equal(maskBrazilianPhone('119999988887777'), '(11) 99999-8888'));
check('empty input', () => { assert.equal(maskBrazilianPhone(''), ''); assert.equal(brazilianPhoneProblem(''), 'empty'); assert.equal(toBrazilianE164(''), null); });
check('incomplete number', () => { assert.equal(brazilianPhoneProblem('119999'), 'incomplete'); assert.equal(toBrazilianE164('(11) 9999'), null); });
check('invalid DDDs refused', () => {
  for (const ddd of ['10', '20', '23', '25', '26', '29', '30', '36', '39', '40', '50', '52', '56', '60', '70', '72', '76', '78', '80', '90']) assert.equal(brazilianPhoneProblem(ddd + '999998888'), 'ddd', ddd);
  assert.equal(brazilianPhoneProblem('20'), 'ddd', 'DDD reported as soon as both digits exist');
});
check('leading zero (trunk prefix) dropped, DDD never starts with 0', () => { assert.equal(maskBrazilianPhone('0'), ''); assert.equal(maskBrazilianPhone('011 99999-8888'), '(11) 99999-8888'); });
check('11 digits without leading 9 refused', () => assert.equal(brazilianPhoneProblem('11899998888'), 'mobile-nine'));
check('10-digit mobile missing the 9 is flagged', () => assert.equal(brazilianPhoneProblem('1199998888'), 'mobile-nine'));
check('10-digit with invalid first subscriber digit', () => { assert.equal(brazilianPhoneProblem('1119998888'), 'landline'); assert.equal(brazilianPhoneProblem('1109998888'), 'landline'); });
check('paste with +55', () => {
  for (const raw of ['+55 11 99999-8888', '+55 (11) 99999-8888', '+5511999998888', ' +55-11-99999-8888 ']) { assert.equal(maskBrazilianPhone(raw), '(11) 99999-8888', raw); assert.equal(toBrazilianE164(raw), '+5511999998888', raw); }
});
check('paste with 55 (no plus)', () => { assert.equal(maskBrazilianPhone('5511999998888'), '(11) 99999-8888'); assert.equal(maskBrazilianPhone('55 11 3333-4444'), '(11) 3333-4444'); });
check('DDD 55 is not mistaken for the country code', () => { assert.equal(maskBrazilianPhone('55999998888'), '(55) 99999-8888'); assert.equal(toBrazilianE164('(55) 99999-8888'), '+5555999998888'); assert.equal(maskBrazilianPhone('55'), '(55'); });
check('+55 with DDD 55', () => assert.equal(toBrazilianE164('+55 55 99999-8888'), '+5555999998888'));
check('E.164 output passes the server regex', () => {
  for (const raw of ['(11) 99999-8888', '(11) 3333-4444', '+55 21 98888-7777', '5591988887777', '(99) 2345-6789']) { const e164 = toBrazilianE164(raw); assert.ok(e164 && SERVER_REGEX.test(e164), `${raw} -> ${e164}`); assert.ok(e164.startsWith('+55')); }
});
check('digits helper is idempotent on masked values', () => { assert.equal(brazilianPhoneDigits('(11) 99999-8888'), '11999998888'); assert.equal(maskBrazilianPhone(maskBrazilianPhone('11999998888')), '(11) 99999-8888'); });
check('every problem has a message', () => { for (const key of ['empty', 'incomplete', 'ddd', 'mobile-nine', 'landline']) assert.ok(BRAZILIAN_PHONE_MESSAGES[key]?.length > 10, key); });
check('edit: typing at end keeps caret at end', () => assert.deepEqual(applyBrazilianPhoneEdit('(11) 9999', '(11) 99999', 10), { value: '(11) 9999-9', caret: 11 }));
check('edit: backspace over "-" removes the previous digit', () => {
  // "(11) 9999-8888" -> caret after "-" (10); backspace removes "-" → "(11) 99998888", caret 9
  const result = applyBrazilianPhoneEdit('(11) 9999-8888', '(11) 99998888', 9);
  assert.equal(result.value, '(11) 9998-888'); assert.equal(result.caret, 8);
});
check('edit: backspace over ") " removes the DDD digit', () => assert.equal(applyBrazilianPhoneEdit('(11) 9', '(11 9', 3).value, '(19'));
check('edit: insertion in the middle keeps caret after inserted digit', () => {
  // "(11) 9999-888" insert "7" after "(11) 99" (caret 8 after insertion)
  const result = applyBrazilianPhoneEdit('(11) 9999-888', '(11) 997999-888', 8);
  assert.equal(result.value, '(11) 99799-9888'); assert.equal(result.caret, 8);
});
check('edit: paste with +55 moves caret to end', () => assert.deepEqual(applyBrazilianPhoneEdit('', '+55 11 99999-8888', 17), { value: '(11) 99999-8888', caret: 15 }));

console.log(`\n${checks} waitlist phone checks passed`);
