import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../apps/growth');
const read=name=>fs.readFileSync(path.join(root,'dist',name),'utf8');
// Bundle only executable interface assets. Learning data never enters the output.
const taxonomy=read('taxonomy.mjs').replace('export const taxonomy =','const projectTaxonomy =');
const model=read('model.mjs').replace(/^export /gm,'');
const app=read('app.mjs').replace(/^import .*?;\r?\n/gm,'');
const html=read('index.html')
  .replace('<link rel="stylesheet" href="./styles.css">',()=>`<style>${read('styles.css')}</style>`)
  .replace('<script type="module" src="./app.mjs"></script>',()=>`<script type="module">\n${taxonomy}\n${model}\n${app}\n</script>`);
const target=path.join(root,'clearwrite-growth.html');
fs.writeFileSync(target,html,'utf8');
console.log(target);
