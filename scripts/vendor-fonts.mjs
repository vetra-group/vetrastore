// Reproducible, licensed font assets. Run only when intentionally updating fonts.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const output=path.resolve('src/app/fonts');
const arabicOnly=process.argv.includes('--arabic');
const cssUrl=arabicOnly ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400..700&family=Noto+Naskh+Arabic:wght@400..600&display=swap' : 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Noto+Sans+Thai:wght@400..700&family=Noto+Serif+Thai:wght@400..600&display=swap';
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Font source returned ${r.status}`);return r;}
await mkdir(output,{recursive:true});
const css=await (await get(cssUrl)).text(), manifest=[];
for(const [name,subset,filename,licenseDir] of arabicOnly ? [['Noto Sans Arabic','arabic','noto-sans-arabic.woff2','notosansarabic'],['Noto Naskh Arabic','arabic','noto-naskh-arabic.woff2','notonaskharabic']] : [['DM Sans','latin','dm-sans-latin.woff2','dmsans'],['Noto Sans Thai','thai','noto-sans-thai.woff2','notosansthai'],['Noto Serif Thai','thai','noto-serif-thai.woff2','notoserifthai']]){
  const face=[...css.matchAll(/\/\* ([^*]+) \*\/\s*@font-face\s*{([^}]+)}/g)].find(m=>m[1].trim()===subset&&m[2].includes(`font-family: '${name}'`));
  const url=face?.[2].match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if(!url)throw Error(`Missing ${name} ${subset}`);
  const bytes=Buffer.from(await (await get(url)).arrayBuffer());
  if(bytes.subarray(0,4).toString()!=='wOF2')throw Error('Invalid font');
  const license=await (await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${licenseDir}/OFL.txt`)).text();
  if(!license.includes('SIL OPEN FONT LICENSE'))throw Error('License not verified');
  await writeFile(path.join(output,filename),bytes);
  await writeFile(path.join(output,`${licenseDir}-OFL.txt`),license);
  manifest.push({name,subset,filename,source:url,license:`${licenseDir}-OFL.txt`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const previous=await readFile(path.join(output,'manifest.json'),'utf8').then(text=>JSON.parse(text).fonts).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
await writeFile(path.join(output,'manifest.json'),JSON.stringify({source:cssUrl,downloadedAt:new Date().toISOString(),fonts:[...previous.filter(font=>!manifest.some(next=>next.filename===font.filename)),...manifest]},null,2));
console.log(manifest.map(({name,bytes})=>({name,bytes})));
