// Une el JS y el CSS de dist-artefacto/ en un solo HTML para publicar en claude.ai.
// Uso: npm run build:artefacto  → dist-artefacto/wpw-navigator-3d.html
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'dist-artefacto/assets';
const archivos = readdirSync(dir);
const leer = (ext) => archivos.filter((f) => f.endsWith(ext)).map((f) => readFileSync(`${dir}/${f}`, 'utf8'));
const js = leer('.js');
const css = leer('.css').join('\n');
if (js.length !== 1) throw new Error(`Se esperaba un solo archivo JS y hay ${js.length}.`);
// Evita que el navegador cierre el <script> antes de tiempo.
const codigo = js[0].replace(/<\/script/gi, '<\\/script');

const html = `<title>WPW Navigator 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="robots" content="noindex">
<style>${css}</style>
<div id="root"></div>
<script type="module">${codigo}</script>
`;
writeFileSync('dist-artefacto/wpw-navigator-3d.html', html);
console.log(`dist-artefacto/wpw-navigator-3d.html (${(html.length / 1024).toFixed(0)} KB)`);
