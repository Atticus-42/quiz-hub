// Classroom conventions follow Codes & Ciphers.pdf (12 pages), including inclusive DSACS counts.
export const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const KEY05 = '3 8 17 4 11 14 1 6 19 12 18 16 7 5 15 9 2 13 10';
export const KEY04 = '12 1 16 13 6 17 20 2 19 7 10 3 14 18 15 11 4 9 5 8';
export const SYSTEMS = [
  {id:'dsacs',name:'Direct standard',short:'DSACS',pages:'1–2',family:'Substitution',description:'Slide the alphabet left or right. The lesson counts the starting position as 1.'},
  {id:'rsacs',name:'Reverse standard',short:'RSACS',pages:'2',family:'Substitution',description:'Reverse the alphabet, beginning with the letter at the indicated position.'},
  {id:'keyword',name:'Keyword mixed',short:'KEYWORD',pages:'4',family:'Substitution',description:'Keep each key letter once, then append the unused alphabet.'},
  {id:'decimation',name:'Decimation',short:'DECIMATION',pages:'3',family:'Substitution',description:'Count around the keyed alphabet, removing every selected letter as you go.'},
  {id:'numerical',name:'Numerical key mixed',short:'NUMERICAL',pages:'5–6',family:'Substitution',description:'Rank the unique key letters alphabetically, then read their columns in rank order.'},
  {id:'playfair',name:'Playfair',short:'PLAYFAIR',pages:'6–7',family:'Digraph',description:'Use a 5 × 5 square and work in pairs. I and J share one cell.'},
  {id:'single',name:'Single transposition',short:'SINGLE',pages:'8–10',family:'Transposition',description:'Write across the grid, then read down columns in numbered order.'},
  {id:'double',name:'Double transposition',short:'DOUBLE',pages:'10–12',family:'Transposition',description:'Apply two column orders. Decipher in the reverse order: key 2, then key 1.'},
];
const mod = (n,m) => ((n%m)+m)%m;
function integer(value,min,max,label) {
  if(String(value).trim()===''||!Number.isInteger(Number(value))||Number(value)<min||Number(value)>max)throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}
export function clean(value,digits=false) {
  const text=String(value).toUpperCase();
  if(/[^A-Z0-9\s.,;:'"!?()\-–—/]/.test(text))throw new Error('Use A–Z letters, spaces and ordinary punctuation only.');
  if(!digits&&/[0-9]/.test(text))throw new Error('This system uses letters only. Spell out numbers, or remove the message header.');
  return text.replace(digits?/[^A-Z0-9]/g:/[^A-Z]/g,'');
}
export function keyed(phrase,playfair=false) {
  let key=clean(phrase);
  if(!key)throw new Error('Enter the assigned keyword or key phrase.');
  if(key.length>200)throw new Error('Keep the key phrase within 200 letters.');
  if(playfair)key=key.replaceAll('J','I');
  const unique=[...new Set(key)].join('');
  return {unique,alphabet:[...new Set(unique+(playfair?ABC.replace('J',''):ABC))].join('')};
}
export function sequence(value) {
  const parts=String(value).trim().split(/[\s,]+/);
  if(parts.length>40||parts.some(x=>!/^\d+$/.test(x)))throw new Error('Enter a column order as numbers separated by spaces, for example 3 1 4 2.');
  const nums=parts.map(Number);
  if(new Set(nums).size!==nums.length||nums.some(n=>n<1||n>nums.length))throw new Error(`The column order must use every number from 1 to ${nums.length} exactly once.`);
  return nums;
}
export function transpose(text,key,decode=false) {
  const width=key.length, rows=Array.from({length:Math.ceil(text.length/width)},()=>Array(width).fill(''));
  const order=key.map((rank,col)=>({rank,col})).sort((a,b)=>a.rank-b.rank);
  let offset=0;
  if(decode) {
    for(const {col} of order)for(let row=0;row<rows.length;row++)if(row*width+col<text.length)rows[row][col]=text[offset++];
  } else [...text].forEach((ch,i)=>{rows[Math.floor(i/width)][i%width]=ch;});
  const columns=order.map(({rank,col})=>({rank,col,text:rows.map(row=>row[col]).join('')}));
  return {output:decode?rows.flat().join(''):columns.map(c=>c.text).join(''),rows,headers:key,columns};
}
function substitution(options) {
  const {system}=options;
  const details=[];let alphabet,grid=null;
  if(system==='dsacs') {
    const count=integer(options.count,1,26,'Indicator count');
    if(!['right','left'].includes(options.shift))throw new Error('Choose a left or right shift.');
    const offset=(count-1)*(options.shift==='right'?-1:1);
    alphabet=[...ABC].map((_,i)=>ABC[mod(i+offset,26)]).join('');
    details.push(`Count ${count} includes the starting position: ${count-1} actual position${count===2?'':'s'} ${options.shift}. Plain A maps to ${alphabet[0]}.`);
  } else if(system==='rsacs') {
    const count=integer(options.count,1,26,'Indicator count');
    alphabet=[...ABC].map((_,i)=>ABC[mod(count-1-i,26)]).join('');
    details.push(`Begin at alphabet position ${count} (${alphabet[0]}), then work backwards.`);
  } else {
    const key=keyed(options.phrase);alphabet=key.alphabet;
    details.push(`Unique key: ${key.unique}`,`Completed keyed alphabet: ${key.alphabet}`);
    if(system==='decimation') {
      const interval=integer(options.interval,1,100,'Interval'), remaining=[...alphabet], picks=[];let cursor=0;
      while(remaining.length){cursor=(cursor+interval-1)%remaining.length;picks.push(remaining.splice(cursor,1)[0]);}
      alphabet=picks.join('');details.push(`Select every ${interval}${interval===1?'st':interval===2?'nd':interval===3?'rd':'th'} remaining letter. Resume counting after the removed letter; removed letters no longer count.`);
    } else if(system==='numerical') {
      const sorted=[...key.unique].sort(), ranks=[...key.unique].map(c=>sorted.indexOf(c)+1);
      grid=transpose(alphabet,ranks);alphabet=grid.output;
      details.push('Rank the unique key alphabetically. Read each column from top to bottom in rank order; empty cells contribute nothing.');
    }
  }
  return {alphabet,details,grid};
}
function preparePairs(text,nullLetter,groupPadding) {
  const pairs=[],insertions=[];
  const other=ch=>ch===nullLetter?(nullLetter==='Q'?'X':'Q'):nullLetter;
  for(let i=0;i<text.length;){const a=text[i],b=text[i+1];
    if(!b||a===b){const filler=other(a);pairs.push(a+filler);insertions.push(`${a}${filler}: inserted ${filler} ${b?'between repeated letters':'after the final unpaired letter'}.`);i++;}
    else {pairs.push(a+b);i+=2;}
  }
  if(groupPadding)while((pairs.length*2)%5!==0){pairs.push(nullLetter+other(nullLetter));insertions.push(`${pairs.at(-1)}: end padding for an even letter count divisible by five.`);}
  return {pairs,insertions};
}
function playfair(text,options,decode) {
  const {alphabet}=keyed(options.phrase,true), rows=Array.from({length:5},(_,r)=>[...alphabet.slice(r*5,r*5+5)]);
  const nullLetter=options.nullLetter||'X';
  if(!['X','Q','Z'].includes(nullLetter))throw new Error('Choose X, Q or Z as the Playfair null.');
  if(decode&&text.length%2)throw new Error('Playfair ciphertext needs an even number of letters. Check for a missing letter.');
  if(decode&&text.includes('J'))throw new Error('The Playfair square uses I for the I/J cell. Replace ciphertext J with I.');
  const normalized=text.replaceAll('J','I');
  const prepared=decode?{pairs:normalized.match(/.{2}/g)||[],insertions:[]}:preparePairs(normalized,nullLetter,options.padding==='five');
  const step=decode?-1:1;
  const steps=prepared.pairs.map(pair=>{
    if(pair[0]===pair[1])throw new Error(`The identical pair ${pair} is not valid Playfair ciphertext under this lesson's rules.`);
    const a=alphabet.indexOf(pair[0]),b=alphabet.indexOf(pair[1]);let ar=Math.floor(a/5),ac=a%5,br=Math.floor(b/5),bc=b%5,rule;
    if(ar===br){ac=mod(ac+step,5);bc=mod(bc+step,5);rule=decode?'Same row: left':'Same row: right';}
    else if(ac===bc){ar=mod(ar+step,5);br=mod(br+step,5);rule=decode?'Same column: up':'Same column: down';}
    else {[ac,bc]=[bc,ac];rule='Rectangle: keep each letter’s row';}
    return {input:pair,output:rows[ar][ac]+rows[br][bc],rule};
  });
  return {output:steps.map(s=>s.output).join(''),prepared:prepared.pairs.join(''),steps,grid:{rows,headers:null},details:[
    'I and J share a cell; J is represented by I.',
    decode?'Null letters are retained. Remove only the nulls that you know were added.':`Split repeated letters within a pair using ${nullLetter}; use ${nullLetter==='Q'?'X':'Q'} if the repeated letter is itself ${nullLetter}.`,
    ...(!decode&&options.padding==='five'?['The lesson requests groups of five and complete pairs. This mode pads to a multiple of 10, alternating nulls to avoid identical pairs. Use pair-only padding if your exercise does not require final five-letter groups.']:[]),
    ...prepared.insertions,
  ]};
}
export function solve(options) {
  const spec=SYSTEMS.find(s=>s.id===options.system);if(!spec)throw new Error('Choose a cipher system.');
  const decode=options.direction==='decode';
  if(!['decode','encode'].includes(options.direction))throw new Error('Choose encipher or decipher.');
  const isTransposition=['single','double'].includes(options.system);
  const text=clean(options.text,isTransposition);
  if(!text)throw new Error('Enter the message body to see its answer.');
  if(text.length>2000)throw new Error('Please use at most 2,000 characters per message.');
  const result={system:spec.id,source:spec.pages,input:text,prepared:text,output:'',details:[],grids:[],steps:[],alphabet:null};
  if(options.system==='playfair') {
    const value=playfair(text,options,decode);Object.assign(result,value);result.grids=[{...value.grid,title:'Playfair square'}];
  } else if(isTransposition) {
    const first=sequence(options.key1),second=options.system==='double'?sequence(options.key2):null;
    let working=text;
    if(!decode&&options.padding==='five')working=working.padEnd(Math.ceil(working.length/5)*5,'X');
    result.prepared=working;
    const keys=second?(decode?[[second,'Key 2'],[first,'Key 1']]:[[first,'Key 1'],[second,'Key 2']]):[[first,'Key 1']];
    for(const [key,title] of keys){const stage=transpose(working,key,decode);result.grids.push({...stage,title});result.steps.push({input:working,output:stage.output,rule:`${title}: ${decode?'fill columns by rank, read rows':'fill rows, read columns by rank'}`});working=stage.output;}
    result.output=working;result.details.push(`Digits are kept. ${decode?'Empty cells are inferred from the exact ciphertext length; nulls are retained.':options.padding==='five'?`${result.prepared.length-text.length} X null(s) added before the first pass, to complete a group of five.`:'No nulls added; incomplete final rows stay incomplete.'}`);
    if(second)result.details.push(decode?'Reverse the passes: key 2 first, then key 1.':'The second pass uses the entire first result, with no additional padding.');
  } else {
    const value=substitution(options);result.alphabet=value.alphabet;result.details=value.details;
    if(value.grid)result.grids=[{...value.grid,title:'Numerical key chart'}];
    const from=decode?value.alphabet:ABC,to=decode?ABC:value.alphabet;
    result.output=[...text].map(c=>to[from.indexOf(c)]).join('');
    result.steps=[...text].map((c,i)=>({input:c,output:result.output[i],rule:`Column ${from.indexOf(c)+1}`}));
  }
  return result;
}
export function indicator(subtractor,value,recover=false) {
  if(!/^\d{4}$/.test(subtractor))throw new Error('The daily subtractor must contain exactly four digits.');
  if(!(recover?/^\d{5}$/:/^\d{4}$/).test(value))throw new Error(recover?'Enter the five-digit indicator.':'Enter four key digits, for example 0005 or 0504.');
  if(recover&&[...value.slice(0,4)].reduce((sum,d)=>sum+Number(d),0)%10!==Number(value[4]))throw new Error('The indicator check digit does not match. Check the five digits you copied.');
  const digits=[...subtractor].map((d,i)=>String(mod(Number(d)-Number(value[i]),10))).join('');
  return recover?digits:digits+([...digits].reduce((sum,d)=>sum+Number(d),0)%10);
}
export const groupFive=text=>(text.match(/.{1,5}/g)||[]).join(' ');
