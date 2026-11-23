import {tablePreview,publicResource,limitedText} from './preview-model.mjs';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function renderPreview(parent,model){
 const table=el('table'),head=el('thead'),tr=el('tr');for(const title of model.headers)tr.append(el('th',title));head.append(tr);table.append(head);
 const body=el('tbody');for(const values of model.rows.slice(0,50)){const row=el('tr');for(let i=0;i<model.headers.length;i++)row.append(el('td',String(values[i]??'').slice(0,1200)));body.append(row);}table.append(body);
 parent.replaceChildren(el('p',model.format+' preview · '+Math.min(50,model.rows.length)+' displayed rows · up to 30 columns. This is a sample, not a complete dataset.'));const scroll=el('div');scroll.className='resource-preview';scroll.tabIndex=0;scroll.append(table);parent.append(scroll);
}
export function resourcePreview(name,url,format){
 const container=el('div'),button=el('button','Preview '+(format||'CSV / JSON')),output=el('div');button.type='button';button.className='btn secondary';
 button.addEventListener('click',async()=>{button.disabled=true;output.textContent='Requesting the published resource…';try{
  const response=await fetch(publicResource(url),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  renderPreview(output,tablePreview(await limitedText(response),format));
 }catch(error){output.textContent=error.message+' The publisher may block browser access. You can download the file and preview a local copy below.';}finally{button.disabled=false;}});
 container.append(button,output);return container;
}
