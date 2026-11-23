import test from 'node:test';import assert from 'node:assert/strict';
import {csvRows,tablePreview,publicResource} from '../web/preview-model.mjs';
test('CSV previews retain quoted commas, newlines, escaped quotes and empty cells',()=>{
 assert.deepEqual(csvRows('name,note,value\r\n"one,two","a\n""quote""",0\r\nempty,,\r\n'),[['name','note','value'],['one,two','a\n"quote"','0'],['empty','','']]);
 assert.throws(()=>csvRows('x\n"bad'));
});
test('CKAN record JSON and arrays preserve zero and missing values with bounded columns',()=>{
 assert.deepEqual(tablePreview('{"result":{"records":[{"n":0,"text":"<img>"}]}}').rows,[['0','<img>']]);
 assert.equal(tablePreview(JSON.stringify(Array.from({length:210},(_,i)=>({i})))).rows.length,200);
 assert.throws(()=>publicResource('javascript:alert(1)'));
 assert.throws(()=>publicResource('https://user:secret@example.ca/'));
});
