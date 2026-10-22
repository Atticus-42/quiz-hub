// Conservative extraction: suggest only stated instructions, never cryptanalyse or repair OCR letters.
export function parseCipherScan(raw) {
  const source=String(raw).slice(0,12000).replace(/\r/g,'');
  const result={system:'',direction:'decode',text:'',count:'',shift:'',phrase:'',interval:'',key1:'',key2:'',warnings:[]};
  const patterns={dsacs:/\bDSACS\b|\bDIRECT STANDARD\b/i,rsacs:/\bRSACS\b|\bREVERSE STANDARD\b/i,keyword:/\bKEY\s*WORD MIXED\b/i,decimation:/\bDECIMATION\b/i,numerical:/\bNUMERICAL KEY(?: MIXED)?\b/i,playfair:/\bPLAY\s*FAIR\b/i,single:/\bSINGLE TRANSPOSITION\b/i,double:/\bDOUBLE TRANSPOSITION\b/i};
  const lines=source.split('\n').map(line=>line.trim());
  const label=/^(?:cipher\s*text|plain\s*text|message|text)\s*[:=]\s*(.*)$/i;
  const field=/^(?:system|method|indicator(?: count)?|count|shift(?: direction)?|direction|key(?:\s*[12]|\s*word| phrase)?|keyword|interval|decimation interval|null|padding|answer|solution)\s*[:=]/i;
  const messageLines=new Set();const messages=[];
  for(let i=0;i<lines.length;i++){
    const match=lines[i].match(label);if(!match)continue;
    const parts=match[1]?[match[1]]:[];messageLines.add(i);
    for(let j=i+1;j<lines.length;j++){
      if(!lines[j])break;
      if(field.test(lines[j])||label.test(lines[j])||Object.values(patterns).some(p=>p.test(lines[j]))||/\b(?:encipher|decipher|encrypt|decrypt)\b/i.test(lines[j]))break;
      if(!/^[A-Za-z0-9\s.,;:'"!?()\-–—/]+$/.test(lines[j]))break;
      parts.push(lines[j]);messageLines.add(j);
    }
    messages.push(parts.join('\n'));
  }
  const instructions=lines.filter((_,i)=>!messageLines.has(i)).join('\n');
  const matches=Object.entries(patterns).filter(([,pattern])=>pattern.test(instructions));
  if(matches.length===1)result.system=matches[0][0];
  else result.warnings.push(matches.length?'More than one cipher system is named. Choose the exercise you want.':'Cipher system not identified. Select it from the lesson instructions.');
  const encode=/\b(?:encipher|encrypt|encipherment|encryption)\b/i.test(instructions),decode=/\b(?:decipher|decrypt|decipherment|decryption)\b/i.test(instructions);
  if(encode&&decode){result.direction='';result.warnings.push('Both directions are mentioned. Choose encipher or decipher.');}
  else if(encode)result.direction='encode';
  if(messages.length===1)result.text=messages[0];
  else if(messages.length>1)result.warnings.push('Several message fields found. Copy the intended message into the review box.');
  else {
    const candidates=lines.filter(line=>/^[A-Z0-9]+(?:[ \t]+[A-Z0-9]+)*$/.test(line)&&line.replace(/\s/g,'').length>=5&&!Object.values(patterns).some(p=>p.test(line))&&!/\b(?:DELTA|ROMEO|LIMA|KEY|INDICATOR|COUNT|DECIPHER|ENCIPHER)\b/.test(line));
    if(candidates.length)result.text=candidates.join('\n');
  }
  const get=pattern=>{const found=instructions.match(pattern);return found?found[1].trim():'';};
  result.phrase=get(/^(?:keyword|key phrase|key word)\s*[:=]\s*(.+)$/im);
  if(!result.phrase&&['keyword','decimation','numerical','playfair'].includes(result.system))result.phrase=get(/^key\s*[:=]\s*(.+)$/im);
  result.key1=get(/^key\s*1\s*[:=]\s*(.+)$/im);result.key2=get(/^key\s*2\s*[:=]\s*(.+)$/im);
  if(result.system==='single'&&!result.key1)result.key1=get(/^key\s*[:=]\s*(.+)$/im);
  result.interval=get(/^(?:decimation )?interval\s*[:=]\s*(\d+)\b/im);
  const count=get(/^(?:indicator(?: count)?|count)\s*[:=]\s*([A-Z0-9 -]+)/im)||get(/\bDELTA\s+([A-Z0-9 -]+?)\s+(?:ROMEO|LIMA)\b/i);
  if(count){
    const words=['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN','TWENTY'];
    const value=count.toUpperCase().trim(),tokens=value.split(/[ -]+/);
    let n=/^\d+$/.test(value)?Number(value):words.indexOf(value);
    if(tokens.length===2&&tokens[0]==='TWENTY'&&words.indexOf(tokens[1])>0)n=20+words.indexOf(tokens[1]);
    else if(tokens.length>1&&tokens.every(t=>words.indexOf(t)>=0&&words.indexOf(t)<10))n=Number(tokens.map(t=>words.indexOf(t)).join(''));
    if(n>=1&&n<=26)result.count=String(n);else result.warnings.push('Indicator count needs review.');
  }
  const right=/\b(?:ROMEO|RIGHT)\b/i.test(instructions),left=/\b(?:LIMA|LEFT)\b/i.test(instructions);
  if(right!==left)result.shift=right?'right':'left';
  if(!result.text)result.warnings.push('Message text not identified. Copy it from the extracted text.');
  if(/[01Il|]/.test(result.text))result.warnings.push('Check similar characters carefully: O/0 and I/l/1. No characters were corrected automatically.');
  if(result.system&&['keyword','decimation','numerical','playfair'].includes(result.system)&&!result.phrase)result.warnings.push('The assigned keyword/key phrase is missing.');
  if(['single','double'].includes(result.system)&&!result.key1)result.warnings.push('Enter the actual column order, not just a key number.');
  return result;
}
