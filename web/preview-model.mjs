export function csvRows(text,limit=201){
 const rows=[];let row=[],cell='',quoted=false;
 const push=()=>{row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=ch;}
  else if(ch===','&&!quoted){row.push(cell);cell='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){push();if(ch==='\r'&&text[i+1]==='\n')i++;if(rows.length>=limit)break;}
  else cell+=ch;
 }
 if(rows.length<limit){if(quoted)throw Error('CSV has an unclosed quoted field.');if(cell||row.length)push();}
 return rows;
}
export function tablePreview(text,format=''){
 const raw=text.replace(/^\uFEFF/,'').trim();if(!raw)throw Error('The file is empty.');
 if(format.toLowerCase().includes('json')||/^[\[{]/.test(raw)){
  const data=JSON.parse(raw),records=Array.isArray(data)?data:data.result?.records??data.records??data.data;
  if(!Array.isArray(records))throw Error('JSON preview needs an array, records, data or result.records array.');
  const objects=records.slice(0,200);const headers=[...new Set(objects.flatMap(x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x):['value']))].slice(0,30);
  const value=x=>x==null?'':typeof x==='object'?JSON.stringify(x):String(x);
  return {headers,rows:objects.map(x=>headers.map(k=>value(k==='value'&&(x===null||typeof x!=='object')?x:x?.[k]))),limited:records.length>200,format:'JSON'};
 }
 const [headers,...rows]=csvRows(raw,202);if(!headers)throw Error('No CSV rows found.');
 return {headers:headers.slice(0,30),rows:rows.slice(0,200).map(r=>r.slice(0,30)),limited:rows.length>200,format:'CSV'};
}
export function publicResource(value){const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Use a public HTTP or HTTPS resource.');return url.href;}
export async function limitedText(response,limit=2_000_000){
 if(!response.ok)throw Error('Resource returned HTTP '+response.status);
 if(Number(response.headers.get('content-length'))>limit)throw Error('Resource is larger than the 2 MB preview limit. Download it and select a smaller extract.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Resource exceeds the 2 MB preview limit.');chunks.push(value);}}
 finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
