// Summarize measured production samples; never synthesize timing or score values.
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../artifacts/experience-v14');
const read=name=>JSON.parse(fs.readFileSync(path.join(out,name+'.json'),'utf8'));
const before=read('perf-before'),after=read('perf-after');
if(before.browser!==after.browser||before.conditions!==after.conditions)throw Error('Browser/conditions changed: compare separately.');
const median=a=>{a.sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2};
const sample=(data,page)=>{
 const rows=data.performance.filter(x=>x.page===page);if(rows.length!==3)throw Error('Expected 3 samples: '+page);
 const value=Object.fromEntries(['jsGzipBytes','cssGzipBytes','apiCount','fcpMs','domContentLoadedMs','loadMs','readyMs'].map(k=>[k,Math.round(median(rows.map(x=>x[k]))*10)/10]));
 return {...value,duplicateCount:rows[0].duplicateApis.length,jsDecodedBytes:rows[0].js.reduce((s,x)=>s+x.bytes,0),cssDecodedBytes:rows[0].css.reduce((s,x)=>s+x.bytes,0)};
};
const report={browser:after.browser,conditions:after.conditions,viewport:'1440x1080',samplesPerPage:3,
 measurement:'gzipSync of each resource actually loaded; local estimate, not wire bytes. readyMs waits for a page-specific content selector, not load event or FCP.',
 pages:['home','materials','analysis','verify','review'].map(page=>{const a=sample(before,page),b=sample(after,page);return {page,before:a,after:b,jsReductionPercent:Math.round((1-b.jsGzipBytes/a.jsGzipBytes)*1000)/10}})};
fs.writeFileSync(path.join(out,'performance-summary.json'),JSON.stringify(report,null,2));
for(const x of report.pages)console.log(`${x.page}: JS ${x.before.jsGzipBytes} -> ${x.after.jsGzipBytes} B; CSS ${x.before.cssGzipBytes} -> ${x.after.cssGzipBytes} B; ready ${x.before.readyMs} -> ${x.after.readyMs} ms; GET ${x.before.apiCount} -> ${x.after.apiCount}`);
