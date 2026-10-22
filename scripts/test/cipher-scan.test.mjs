import test from 'node:test';
import assert from 'node:assert/strict';
// Removing the parser or changing its identification/field extraction must fail these cases.
const module = await import('../../src/cipher/scan-parser.mjs').catch(()=>({}));
test('scanner provides a parser for the existing desk fields',()=>assert.equal(typeof module.parseCipherScan,'function'));
test('reads direct standard instructions without silently changing OCR characters',()=>{
  const result=module.parseCipherScan('DSACS\nDecipher using DELTA NINE ROMEO\nCiphertext: KLMVQ ZSJVP');
  assert.equal(result.system,'dsacs');assert.equal(result.count,'9');assert.equal(result.shift,'right');assert.equal(result.direction,'decode');assert.equal(result.text,'KLMVQ ZSJVP');
  assert.equal(module.parseCipherScan('Ciphertext: O01IL').text,'O01IL');
});
test('identifies all other lesson systems and their stated keys',()=>{
  const cases=[['RSACS\nIndicator: ONE ZERO\nCiphertext: RQPGL','rsacs'],['Keyword Mixed\nKeyword: THE DANCE\nCiphertext: ABCDE','keyword'],['Decimation\nKey phrase: THE DANCE\nInterval: 4\nCiphertext: ABCDE','decimation'],['Numerical Key Mixed\nKeyword: WHERE THE ZEBRAS FEED\nCiphertext: ABCDE','numerical'],['Playfair\nKey: HYPNOTIZED\nEncipher\nPlaintext: BALLOON','playfair'],['Single Transposition\nKey 1: 3 1 2\nCiphertext: ABCDE','single'],['Double Transposition\nKey 1: 3 1 2\nKey 2: 2 1 3\nCiphertext: ABCDE','double']];
  for(const [text,id]of cases)assert.equal(module.parseCipherScan(text).system,id);
  assert.equal(module.parseCipherScan(cases[0][0]).count,'10');assert.equal(module.parseCipherScan(cases[2][0]).interval,'4');
  const playfair=module.parseCipherScan(cases[4][0]);assert.equal(playfair.phrase,'HYPNOTIZED');assert.equal(playfair.direction,'encode');
  assert.equal(module.parseCipherScan(cases[6][0]).key2,'2 1 3');
});
test('unknown and conflicting instructions remain unresolved instead of inheriting example keys',()=>{
  const result=module.parseCipherScan('KLMVQ ZSJVP');assert.equal(result.system,'');assert.equal(result.count,'');assert.equal(result.phrase,'');assert.equal(result.text,'KLMVQ ZSJVP');assert.ok(result.warnings.length);
  assert.equal(module.parseCipherScan('Use DSACS or Playfair\nCiphertext: ABCDE').system,'');
  assert.equal(module.parseCipherScan('DSACS\nCiphertext: ABCDE').shift,'');
});
test('multiline message ends before a new field and unrelated prose is not treated as ciphertext',()=>{
  assert.equal(module.parseCipherScan('DSACS\nCiphertext:\nABCDE FGHIJ\nKLMNO\nIndicator count: 5').text,'ABCDE FGHIJ\nKLMNO');
  assert.equal(module.parseCipherScan('Please explain this exercise to the class.').text,'');
});
