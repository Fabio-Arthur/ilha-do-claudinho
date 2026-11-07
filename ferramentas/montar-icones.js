// Junta os ícones do Lucide que a ilha usa num arquivo só: ilha/icones.js
//
// Por que não usar os arquivos .svg direto? Porque a ilha abre como "arquivo"
// (file://) e, por segurança, o navegador não deixa um SVG puxar desenho de
// outro arquivo. Então colocamos todos os desenhos dentro da própria página.
//
// Quer um ícone novo? Procure o nome em https://lucide.dev/icons, coloque na
// lista abaixo e rode:  npm run icones
// Na página, use assim:  <svg class="icone"><use href="#i-NOME" /></svg>

const fs = require('fs');
const path = require('path');

const ICONES = [
  // abas
  'music',
  'cpu',
  'gamepad-2',
  // player
  'skip-back',
  'play',
  'pause',
  'skip-forward',
  'headphones',
  // cartões do PC
  'memory-stick',
  'monitor',
  'thermometer',
  'gauge',
  // conexões
  'wifi',
  'bluetooth',
  'battery-charging',
  'battery',
  'zap',
  // clima
  'sun',
  'moon',
  'cloud-sun',
  'cloud-moon',
  'cloud',
  'cloud-fog',
  'cloud-drizzle',
  'cloud-rain',
  'cloud-sun-rain',
  'cloud-moon-rain',
  'cloud-snow',
  'cloud-lightning',
  'droplets',
  'map-pin',
  'map-pin-off',
  'arrow-down',
  'arrow-up',
];

const pastaLucide = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');

const simbolos = ICONES.map((nome) => {
  const svg = fs.readFileSync(path.join(pastaLucide, `${nome}.svg`), 'utf8');
  // Pega só o "recheio" (o que está entre <svg ...> e </svg>)
  const recheio = svg
    .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .replace(/\s+/g, ' ')
    .trim();
  return `<symbol id="i-${nome}" viewBox="0 0 24 24">${recheio}</symbol>`;
});

const saida = `// GERADO por ferramentas/montar-icones.js — não edite à mão, rode "npm run icones".
// Ícones: Lucide (https://lucide.dev), licença ISC.
document.body.insertAdjacentHTML(
  'afterbegin',
  '<svg class="sprite-icones" aria-hidden="true">${simbolos.join('')}</svg>',
);
`;

fs.writeFileSync(path.join(__dirname, '..', 'ilha', 'icones.js'), saida);
console.log(`Pronto: ${ICONES.length} ícones em ilha/icones.js`);
