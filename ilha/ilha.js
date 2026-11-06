// Comportamento da ilha: abrir/fechar, abas, música e desempenho do PC.

const ilhaElemento = document.getElementById('ilha');
const textoBarra = document.getElementById('texto-barra');
const capa = document.getElementById('capa');
const titulo = document.getElementById('titulo');
const artista = document.getElementById('artista');
const trilho = document.getElementById('trilho');
const tempoAtual = document.getElementById('tempo-atual');
const tempoTotal = document.getElementById('tempo-total');

let musicaAtual = { tem_musica: false };
let timerDeFechar = null;

// ---------- Abrir e fechar ----------

ilhaElemento.addEventListener('mouseenter', () => {
  clearTimeout(timerDeFechar); // o mouse voltou: cancela o fechamento
  window.ilha.mouseNaIlha(true); // agora a janela aceita clique
  ilhaElemento.classList.add('aberta');
  window.ilha.avisarAberta(true); // bastidor começa a medir o PC
});

ilhaElemento.addEventListener('mouseleave', () => {
  // Espera um tiquinho antes de fechar, pra não fechar se o mouse escapou sem querer
  timerDeFechar = setTimeout(() => {
    ilhaElemento.classList.remove('aberta');
    window.ilha.mouseNaIlha(false); // volta a deixar o clique passar
    window.ilha.avisarAberta(false);
  }, 350);
});

// Botão direito: menu com "Fechar a ilha"
ilhaElemento.addEventListener('contextmenu', (evento) => {
  evento.preventDefault();
  window.ilha.abrirMenu();
});

// ---------- Abas ----------

// "lembrar" = guardar como aba preferida. A troca automática do jogo não guarda,
// senão depois de jogar a ilha ficaria presa na aba PC.
function escolherAba(aba, lembrar = true) {
  ilhaElemento.dataset.aba = aba;
  if (!lembrar) return;
  try {
    localStorage.setItem('aba', aba);
  } catch {}
}

for (const botao of document.querySelectorAll('.abas button')) {
  botao.addEventListener('click', () => escolherAba(botao.dataset.aba));
}

try {
  const abaSalva = localStorage.getItem('aba');
  if (abaSalva) escolherAba(abaSalva);
} catch {}

// ---------- Botões da música ----------

for (const botao of document.querySelectorAll('[data-comando]')) {
  botao.addEventListener('click', () => window.ilha.comandoMusica(botao.dataset.comando));
}

// Clicar na barrinha pula pra aquela parte da música
trilho.addEventListener('click', (evento) => {
  const tempo = musicaAtual.tempo;
  if (!tempo) return;
  const fracao = evento.offsetX / trilho.clientWidth; // 0 = começo, 1 = fim
  const segundos = fracao * tempo.duracao;
  window.ilha.comandoMusica('ir_para:' + segundos.toFixed(1));
  // Já mexe a barrinha na hora, sem esperar o player responder
  musicaAtual.tempo = { ...tempo, posicao: segundos, medido_em: Date.now() };
  atualizarProgresso();
});

// ---------- Música mudou ----------

window.ilha.quandoMusicaMudar((estado) => {
  const capaMudou = estado.capa !== musicaAtual.capa;
  musicaAtual = estado;

  ilhaElemento.classList.toggle('sem-som', !estado.tem_musica);
  ilhaElemento.classList.toggle('tocando', Boolean(estado.tem_musica && estado.tocando));
  ilhaElemento.classList.toggle('sem-tempo', !estado.tempo);

  if (estado.tem_musica) {
    titulo.textContent = estado.titulo;
    artista.textContent = estado.artista;
    if (capaMudou) trocarCapa(estado.capa);
  }

  atualizarTextoDaBarra();
  atualizarProgresso();
});

// A mesma capa aparece em 3 lugares: grande, mini (ilha fechada) e borrada de fundo
const capaMini = document.getElementById('capa-mini');
const capaFundo = document.getElementById('capa-fundo');

function trocarCapa(imagem) {
  if (!imagem) {
    for (const lugar of [capa, capaMini, capaFundo]) lugar.removeAttribute('src');
    ilhaElemento.style.removeProperty('--cor-capa'); // volta pra lavanda
    return;
  }
  for (const lugar of [capa, capaMini, capaFundo]) lugar.src = imagem;
  capa.onload = () => ilhaElemento.style.setProperty('--cor-capa', corDaCapa(capa));
}

// Descobre "a cor" da capa: encolhe a imagem pra 1 pixel (o navegador faz a média)
// e depois deixa essa cor mais viva, porque a média costuma sair meio acinzentada.
function corDaCapa(imagem) {
  const tela = document.createElement('canvas');
  tela.width = 1;
  tela.height = 1;
  const pincel = tela.getContext('2d');
  pincel.drawImage(imagem, 0, 0, 1, 1);
  const [r, g, b] = pincel.getImageData(0, 0, 1, 1).data;

  const { matiz, saturacao } = rgbParaHsl(r, g, b);
  // Mantém o "tom" da capa, mas com cor forte e clarinha pra brilhar no fundo escuro
  return `hsl(${matiz} ${Math.max(saturacao, 55)}% 68%)`;
}

function rgbParaHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const diferenca = maior - menor;
  const luz = (maior + menor) / 2;
  if (diferenca === 0) return { matiz: 260, saturacao: 0 }; // cinza puro: puxa pra lavanda
  const saturacao = diferenca / (1 - Math.abs(2 * luz - 1));
  let matiz;
  if (maior === r) matiz = ((g - b) / diferenca) % 6;
  else if (maior === g) matiz = (b - r) / diferenca + 2;
  else matiz = (r - g) / diferenca + 4;
  return { matiz: Math.round((matiz * 60 + 360) % 360), saturacao: Math.round(saturacao * 100) };
}

// ---------- Barrinha de progresso ----------

function formatarTempo(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = Math.floor(segundos % 60);
  return `${minutos}:${String(resto).padStart(2, '0')}`;
}

function atualizarProgresso() {
  const tempo = musicaAtual.tempo;
  if (!tempo) return;

  // O player só avisa a posição de vez em quando. Se está tocando,
  // a gente soma o tempo que passou desde o último aviso.
  let posicao = tempo.posicao;
  if (musicaAtual.tocando) posicao += (Date.now() - tempo.medido_em) / 1000;
  posicao = Math.min(Math.max(posicao, 0), tempo.duracao);

  tempoAtual.textContent = formatarTempo(posicao);
  tempoTotal.textContent = formatarTempo(tempo.duracao);
  trilho.style.setProperty('--progresso', (posicao / tempo.duracao) * 100 + '%');
}

setInterval(atualizarProgresso, 500);

// ---------- Desempenho do PC ----------

// Preenche um cartão: número grande, barrinha e cor de alerta
function preencherCartao(id, { valor, nivel, detalhe, morno, quente }) {
  const cartao = document.getElementById(id);
  cartao.querySelector('.valor').textContent = valor;
  cartao.querySelector('.detalhe').textContent = detalhe ?? '';
  cartao.style.setProperty('--nivel', Math.min(nivel, 100) + '%');
  cartao.classList.toggle('quente', nivel >= quente);
  cartao.classList.toggle('morno', nivel >= morno && nivel < quente);
}

let ultimasMedidas = null; // guardadas pra barra fechada mostrar durante o jogo

window.ilha.quandoPcMudar((pc) => {
  ultimasMedidas = pc;
  atualizarTextoDaBarra();

  preencherCartao('cartao-cpu', { valor: pc.cpu + '%', nivel: pc.cpu, detalhe: 'Ryzen 7', morno: 70, quente: 90 });

  preencherCartao('cartao-ram', {
    valor: pc.ram + '%',
    nivel: pc.ram,
    detalhe: `${pc.ramUsadaGb.toFixed(1)} de ${Math.round(pc.ramTotalGb)} GB`,
    morno: 75,
    quente: 90,
  });

  if (pc.gpu) {
    preencherCartao('cartao-gpu', {
      valor: pc.gpu.uso + '%',
      nivel: pc.gpu.uso,
      detalhe: `VRAM ${(pc.gpu.vramUsada / 1024).toFixed(1)}/${Math.round(pc.gpu.vramTotal / 1024)} GB`,
      morno: 70,
      quente: 90,
    });
    // Temperatura: a barrinha vai de 0 a 100 °C; esquenta a partir de 75 e alerta em 85
    preencherCartao('cartao-temperatura', {
      valor: Math.round(pc.gpu.temperatura) + '°',
      nivel: pc.gpu.temperatura,
      detalhe: pc.gpu.temperatura >= 85 ? 'tá quente!' : 'GTX 1650',
      morno: 75,
      quente: 85,
    });
  }
});

// ---------- Modo jogo ----------
// Abriu um jogo: pula pra aba PC. Fechou: volta pra aba de antes.

const iconeAbaPc = document.getElementById('icone-aba-pc');
const textoAbaPc = document.getElementById('texto-aba-pc');
let jogoAtual = null;
let abaAntesDoJogo = null;

window.ilha.quandoJogoMudar((jogo) => {
  const comecouAJogar = jogo && !jogoAtual;
  const parouDeJogar = !jogo && jogoAtual;

  if (comecouAJogar) {
    abaAntesDoJogo = ilhaElemento.dataset.aba;
    escolherAba('pc', false);
  }
  if (parouDeJogar) {
    escolherAba(abaAntesDoJogo, false);
    ultimasMedidas = null;
  }

  jogoAtual = jogo;
  ilhaElemento.classList.toggle('jogando', Boolean(jogo));
  // A aba mostra o controle + nome do jogo, e volta pro chip + "PC" depois
  iconeAbaPc.setAttribute('href', jogo ? '#i-gamepad-2' : '#i-cpu');
  textoAbaPc.textContent = jogo || 'PC';
  atualizarTextoDaBarra();
});

// ---------- Relógio ----------

const horaMinuto = document.getElementById('hora-minuto');
const segundos = document.getElementById('segundos');

function atualizarRelogio() {
  const agora = new Date().toLocaleTimeString('pt-BR'); // "15:48:26"
  horaMinuto.textContent = agora.slice(0, 5); // "15:48"
  segundos.textContent = agora.slice(5); // ":26" (fica mais clarinho no CSS)
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);

// ---------- Wi-Fi ----------

// Duas fontes de informação se juntam aqui:
//   - a rede (nome e sinal), que vem do netsh a cada 10 s
//   - os rádios (Wi-Fi/Bluetooth ligado ou desligado), que vêm do radios.py
let rede = { conectado: false };
let radios = { wifi: true, bluetooth: null };

const iconeWifi = document.getElementById('wifi');
const gomosWifi = iconeWifi.querySelectorAll('.gomo');
const iconeBluetooth = document.getElementById('bluetooth');
const botaoStatus = document.getElementById('status');

function desenharConexoes() {
  // --- Ícone do Wi-Fi: sinal 0–100% vira de 1 a 3 gomos acesos ---
  const gomosAcesos = rede.conectado ? Math.max(1, Math.ceil(rede.sinal / 34)) : 0;
  gomosWifi.forEach((gomo, posicao) => gomo.classList.toggle('aceso', posicao < gomosAcesos));
  iconeWifi.classList.toggle('desligado', radios.wifi === false);

  // --- Ícone do Bluetooth ---
  iconeBluetooth.classList.toggle('ligado', radios.bluetooth === true);
  iconeBluetooth.classList.toggle('nao-tem', radios.bluetooth === null);

  // --- Dica ao parar o mouse no status ---
  botaoStatus.title = rede.conectado ? `${rede.nome} · ${rede.sinal}%` : 'Sem Wi-Fi';

  // --- Cartão do Wi-Fi ---
  let nomeWifi = 'Desconectado';
  let detalheWifi = 'nenhuma rede';
  if (radios.wifi === false) {
    nomeWifi = 'Desligado';
    detalheWifi = 'modo avião?';
  } else if (rede.conectado) {
    nomeWifi = rede.nome;
    detalheWifi = `sinal ${rede.sinal}%`;
  }
  document.getElementById('wifi-nome').textContent = nomeWifi;
  document.getElementById('wifi-detalhe').textContent = detalheWifi;

  // --- Cartão do Bluetooth ---
  const bluetoothLigado = radios.bluetooth === true;
  document.getElementById('bluetooth-valor').textContent =
    radios.bluetooth === null ? 'Não tem' : bluetoothLigado ? 'Ligado' : 'Desligado';
  document.getElementById('bluetooth-detalhe').textContent = bluetoothLigado ? 'pronto pra parear' : '';

  // --- Chavinhas: mostram o estado de verdade e param de piscar ---
  for (const chave of document.querySelectorAll('.chave')) {
    chave.classList.toggle('ligada', radios[chave.dataset.radio] === true);
    chave.classList.remove('esperando');
  }
}

window.ilha.quandoWifiMudar((novaRede) => {
  rede = novaRede;
  desenharConexoes();
});

window.ilha.quandoRadiosMudarem((novosRadios) => {
  radios = novosRadios;
  desenharConexoes();
});

// Clicar numa chavinha: pede pro Windows ligar/desligar e pisca até ele obedecer
for (const chave of document.querySelectorAll('.chave')) {
  chave.addEventListener('click', () => {
    const acao = chave.classList.contains('ligada') ? 'desligar' : 'ligar';
    chave.classList.toggle('ligada'); // já mexe a bolinha, sem esperar
    chave.classList.add('esperando');
    window.ilha.comandoRadio(`${chave.dataset.radio}:${acao}`);
  });
}

// Links "Redes ›", "Aparelhos ›", "Energia ›": abrem a tela certa do Windows
for (const link of document.querySelectorAll('[data-tela]')) {
  link.addEventListener('click', () => window.ilha.abrirTela(link.dataset.tela));
}

// Clicar no status (Wi-Fi/Bluetooth/bateria) abre a aba Conexões
botaoStatus.addEventListener('click', () => escolherAba('conexoes', false));

// ---------- Bateria ----------
// O navegador (Chromium, dentro do Electron) já sabe a bateria: navigator.getBattery()

const bateria = document.getElementById('bateria');
const bateriaTexto = document.getElementById('bateria-texto');

// 5400 segundos → "1h 30min"
function formatarDuracao(segundosTotais) {
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.round((segundosTotais % 3600) / 60);
  return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
}

async function ligarBateria() {
  const infoBateria = await navigator.getBattery();

  function mostrarBateria() {
    const porcentagem = Math.round(infoBateria.level * 100);
    bateriaTexto.textContent = porcentagem + '%'; // o raiozinho de carregando é um ícone no HTML
    bateria.style.setProperty('--carga', porcentagem + '%');
    bateria.classList.toggle('carregando', infoBateria.charging);
    bateria.classList.toggle('baixa', porcentagem <= 20 && !infoBateria.charging);

    // Cartão da aba Conexões, com a estimativa de tempo
    // (o Windows manda "Infinity" quando ainda não sabe calcular)
    let detalhe;
    if (infoBateria.charging) {
      detalhe = Number.isFinite(infoBateria.chargingTime) && infoBateria.chargingTime > 0
        ? `cheia em ${formatarDuracao(infoBateria.chargingTime)}`
        : porcentagem === 100 ? 'carregada' : 'carregando';
    } else {
      detalhe = Number.isFinite(infoBateria.dischargingTime)
        ? `dura uns ${formatarDuracao(infoBateria.dischargingTime)}`
        : 'na bateria';
    }
    document.getElementById('bateria-valor').textContent = porcentagem + '%';
    document.getElementById('bateria-detalhe').textContent = detalhe;
  }

  infoBateria.addEventListener('chargingtimechange', mostrarBateria);
  infoBateria.addEventListener('dischargingtimechange', mostrarBateria);

  mostrarBateria();
  // A bateria avisa sozinha quando muda: não precisa ficar perguntando
  infoBateria.addEventListener('levelchange', mostrarBateria);
  infoBateria.addEventListener('chargingchange', mostrarBateria);
}

ligarBateria();

// ---------- Texto da barra fechada ----------
// Jogando: GPU e temperatura. Com música: o nome da música. Sem nada: a data.

function atualizarTextoDaBarra() {
  if (jogoAtual && ultimasMedidas?.gpu) {
    const { uso, temperatura } = ultimasMedidas.gpu;
    // (o controlezinho antes do texto é um ícone no HTML, aparece sozinho no modo jogo)
    textoBarra.textContent = `GPU ${uso}% · ${Math.round(temperatura)}° · CPU ${ultimasMedidas.cpu}%`;
  } else if (jogoAtual) {
    textoBarra.textContent = jogoAtual;
  } else if (musicaAtual.tem_musica) {
    textoBarra.textContent = musicaAtual.titulo;
  } else {
    // "qui., 6 de nov." — o jeito curtinho que o Brasil escreve a data
    textoBarra.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
}

atualizarTextoDaBarra();
setInterval(atualizarTextoDaBarra, 60_000); // a data vira sozinha à meia-noite
