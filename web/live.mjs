import {resourcePreview,renderPreview} from './preview.mjs';
import {tablePreview,publicResource} from './preview-model.mjs';
const $=id=>document.getElementById(id),el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const local=value=>typeof value==='string'?value:value?.en||value?.fr||'';
let token=0,offset=0,lastQuery='';
const cache=new Map();
async function search(){
 const request=++token,query=$('live-query').value.trim();if(query!==lastQuery){offset=0;lastQuery=query;}
 $('live-prev').disabled=true;$('live-next').disabled=true;
 $('live-status').textContent='Searching the current federal catalogue…';$('live-results').replaceChildren();
 try{
  const url='https://open.canada.ca/data/api/3/action/package_search?'+new URLSearchParams({q:query,rows:10,start:offset});
  let data=cache.get(url);if(!data){const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Catalogue returned HTTP '+response.status);data=await response.json();if(!data.success||!Array.isArray(data.result?.results))throw Error('The catalogue returned an unexpected response.');cache.set(url,data);if(cache.size>20)cache.delete(cache.keys().next().value);}
  if(request!==token)return;
  $('live-status').textContent=data.result.count.toLocaleString()+' current records · showing '+(data.result.count?offset+1:0)+'–'+Math.min(offset+10,data.result.count)+'. Search terms are sent to Open Government Canada.';
  for(const record of data.result.results){
   const card=el('article');card.className='card';const title=el('h3',local(record.title_translated)||local(record.title)||record.name);card.append(title,el('p',(local(record.organization?.title)||'Publisher not supplied')+' · '+(record.metadata_modified||'Update date not supplied')));
   const anchor=Object.assign(el('a','Open official record'),{href:'https://open.canada.ca/data/en/dataset/'+encodeURIComponent(record.id),target:'_blank',rel:'noopener noreferrer'});card.append(anchor);
   const text=local(record.notes_translated)||local(record.notes);if(text)card.append(el('p',text.slice(0,1000)));
   card.append(el('p','Licence: '+(local(record.license_title)||record.license_id||'Check publisher')));
   const details=el('details');details.append(el('summary',(record.resources||[]).length+' published resources'));
   for(const resource of (record.resources||[]).slice(0,100)){try{
    const url=publicResource(resource.url),name=local(resource.name_translated)||local(resource.name)||resource.format||'Resource',row=el('p');row.append(Object.assign(el('a',name+' · '+(resource.format||'format unspecified')),{href:url,target:'_blank',rel:'noopener noreferrer'}));details.append(row);
    if(/csv|json/i.test(resource.format||''))details.append(resourcePreview(name,url,resource.format));
   }catch{}}
   card.append(details);$('live-results').append(card);
  }
  $('live-prev').disabled=offset===0;$('live-next').disabled=offset+10>=data.result.count;
 }catch(error){if(request===token)$('live-status').textContent=error.message+' The downloaded catalogue above remains available.';}
}
$('live-form').addEventListener('submit',e=>{e.preventDefault();offset=0;search();});
$('live-prev').addEventListener('click',()=>{offset=Math.max(0,offset-10);search();});
$('live-next').addEventListener('click',()=>{offset+=10;search();});
$('preview-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Choose a CSV or JSON file under 2 MB.');renderPreview($('local-preview'),tablePreview(await file.text(),file.name));}catch(error){$('local-preview').textContent=error.message;}event.target.value='';});
