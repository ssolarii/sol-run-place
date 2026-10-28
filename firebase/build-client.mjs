import {build} from 'esbuild';
import {readFile, readdir, unlink, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const packageInfo = JSON.parse(await readFile(path.join(here,'node_modules/firebase/package.json'),'utf8'));
if (packageInfo.version !== '13.0.0') throw Error('Expected the reviewed Firebase SDK version');
const outdir = path.join(here,'../world-draft/assets/submissions');
const result = await build({
  absWorkingDir:here, entryPoints:{'submissions-client':'./submissions-client.mjs'},
  outdir,
  bundle:true, splitting:true, format:'esm', platform:'browser', target:['es2022'],
  minify:true, sourcemap:false, metafile:true, chunkNames:'chunks/[name]-[hash]', legalComments:'eof'
});
if (Object.values(result.metafile.outputs).some(output=>output.imports.some(item=>item.external))) {
  throw Error('The self-hosted bundle cannot depend on external module imports');
}
const generated = new Set(Object.keys(result.metafile.outputs).map(file=>path.resolve(here,file)));
for (const file of generated) {
  if (!file.endsWith('.js')) continue;
  const text=await readFile(file,'utf8');
  const index=text.indexOf('/*! Bundled license information:');
  if (index>=0) await writeFile(file,text.slice(0,index)+text.slice(index).split('\n').map(line=>line.trimEnd()).join('\n'));
}
for (const file of await readdir(outdir,{recursive:true})) {
  const resolved=path.resolve(outdir,file);
  if (file.endsWith('.js') && resolved.startsWith(path.resolve(outdir)+path.sep) && !generated.has(resolved)) await unlink(resolved);
}
console.log('Built self-hosted submission client with Firebase '+packageInfo.version+'.');
