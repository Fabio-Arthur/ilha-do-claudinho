// Processo principal do Electron: cria a janela da ilha e liga ela ao ajudante da música.
// (A parte visual fica em ilha/. Aqui é o "bastidor".)

const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron');
const { spawn, execFile } = require('child_process');
const os = require('os');
const path = require('path');
const { reservarEspaco, liberarEspaco } = require('./espaco-reservado');

// A janela é maior que a ilha: a sobra é transparente e deixa espaço pra ilha crescer
const LARGURA_JANELA = 480;
const ALTURA_JANELA = 220;

// Faixa do topo que a ilha "pega pra ela" (mesma altura da ilha fechada, no ilha.css).
// As janelas maximizadas começam embaixo dela. Coloque 0 pra desligar.
const ALTURA_RESERVADA = 0;

let janela = null;
let ajudanteMusica = null;
let ajudanteJogos = null;
let ajudanteRadios = null;
let medidorPc = null; // o "relógio" que mede o PC enquanto a ilha está aberta

function criarJanela() {
  const tela = screen.getPrimaryDisplay();

  janela = new BrowserWindow({
    width: LARGURA_JANELA,
    height: ALTURA_JANELA,
    x: Math.round(tela.bounds.x + (tela.bounds.width - LARGURA_JANELA) / 2), // centro
    y: tela.bounds.y, // grudada no topo
    frame: false, // sem barra de título
    transparent: true, // fundo invisível
    resizable: false,
    hasShadow: false,
    skipTaskbar: true, // não aparece na barra de tarefas
    focusable: false, // não rouba o teclado do que você estiver fazendo (jogo, código...)
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 'screen-saver' é o nível mais alto: fica por cima até da barra de tarefas
  janela.setAlwaysOnTop(true, 'screen-saver');

  // Começa "atravessável": o clique passa pela parte transparente e chega no que está atrás.
  // forward: true continua avisando a página quando o mouse se mexe, pra ela saber quando
  // o mouse entrou na ilha.
  janela.setIgnoreMouseEvents(true, { forward: true });

  janela.loadFile(path.join(__dirname, 'ilha', 'index.html'));

  if (ALTURA_RESERVADA > 0) reservarEspaco(janela, tela, ALTURA_RESERVADA);
  janela.on('closed', liberarEspaco); // garantia extra: fechou a janela, devolve o espaço

  // Quando a faixa é reservada, o Windows empurra TODAS as janelas pra baixo dela,
  // inclusive a própria ilha. Então colocamos a ilha de volta no topo, na faixa dela.
  const voltarProTopo = () => {
    const posicaoCerta = {
      x: Math.round(tela.bounds.x + (tela.bounds.width - LARGURA_JANELA) / 2),
      y: tela.bounds.y,
    };
    const [x, y] = janela.getPosition();
    if (x !== posicaoCerta.x || y !== posicaoCerta.y) janela.setPosition(posicaoCerta.x, posicaoCerta.y);
  };
  voltarProTopo();
  setTimeout(voltarProTopo, 500); // o empurrão às vezes chega atrasado
  janela.on('moved', voltarProTopo);
  screen.on('display-metrics-changed', voltarProTopo); // mudou resolução/zoom: confere de novo
}

// ---------- Ajudantes em Python ----------

// Liga um ajudante (arquivo .py da pasta ajudantes/) e chama "aoReceber" a cada
// linha de JSON que ele mandar. Devolve o processo, pra gente poder escrever nele.
// Se ele cair, liga de novo sozinho depois de 3 segundos.
function ligarAjudante(arquivo, aoReceber, aoReligar) {
  const python = path.join(__dirname, 'ajudantes', '.venv', 'Scripts', 'python.exe');
  const ajudante = spawn(python, ['-u', path.join(__dirname, 'ajudantes', arquivo)], {
    windowsHide: true,
  });

  // Os pedaços de texto podem chegar quebrados, então juntamos num "balde"
  // até ter uma linha inteira.
  let balde = '';
  ajudante.stdout.on('data', (pedaco) => {
    balde += pedaco.toString();
    const linhas = balde.split('\n');
    balde = linhas.pop(); // o último pedaço pode estar incompleto: guarda pra depois
    for (const linha of linhas) {
      if (linha.trim()) aoReceber(JSON.parse(linha));
    }
  });

  ajudante.stderr.on('data', (erro) => console.error(`[${arquivo}]`, erro.toString()));

  ajudante.on('exit', () => {
    if (!app.isQuitting) setTimeout(() => aoReligar(ligarAjudante(arquivo, aoReceber, aoReligar)), 3000);
  });

  return ajudante;
}

function ligarAjudanteMusica() {
  const aoReceber = (estado) => janela.webContents.send('musica-mudou', estado);
  const guardar = (processo) => (ajudanteMusica = processo);
  guardar(ligarAjudante('musica.py', aoReceber, guardar));
}

// ---------- Jogos ----------

let ilhaAberta = false;
let jogoAberto = null; // nome do jogo, ou null

function ligarAjudanteJogos() {
  const aoReceber = ({ jogo }) => {
    jogoAberto = jogo;
    janela.webContents.send('jogo-mudou', jogo);
    atualizarMedidor(); // jogando: mede o PC mesmo com a ilha fechada
  };
  ajudanteJogos = ligarAjudante('jogos.py', aoReceber, (processo) => (ajudanteJogos = processo));
}

// ---------- Desempenho do PC ----------

// O uso da CPU é "quanto tempo ela passou trabalhando desde a última olhada".
// Então guardamos a medida anterior pra comparar com a nova.
let cpuAnterior = medirTemposDaCpu();

function medirTemposDaCpu() {
  let ocupada = 0;
  let total = 0;
  for (const nucleo of os.cpus()) {
    const t = nucleo.times;
    ocupada += t.user + t.nice + t.sys + t.irq;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { ocupada, total };
}

function lerUsoDaCpu() {
  const agora = medirTemposDaCpu();
  const ocupada = agora.ocupada - cpuAnterior.ocupada;
  const total = agora.total - cpuAnterior.total;
  cpuAnterior = agora;
  return total > 0 ? Math.round((ocupada / total) * 100) : 0;
}

// A placa de vídeo NVIDIA tem um programinha próprio que responde tudo: o nvidia-smi
function lerPlacaDeVideo() {
  return new Promise((resolver) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 3000 },
      (erro, saida) => {
        if (erro) return resolver(null); // sem NVIDIA ou deu ruim: a ilha mostra "—"
        const [uso, temperatura, vramUsada, vramTotal] = saida.trim().split(',').map(Number);
        resolver({ uso, temperatura, vramUsada, vramTotal });
      },
    );
  });
}

async function medirPc() {
  const ramTotal = os.totalmem();
  const ramUsada = ramTotal - os.freemem();
  janela.webContents.send('pc-mudou', {
    cpu: lerUsoDaCpu(),
    ram: Math.round((ramUsada / ramTotal) * 100),
    ramUsadaGb: ramUsada / 1024 ** 3,
    ramTotalGb: ramTotal / 1024 ** 3,
    gpu: await lerPlacaDeVideo(),
  });
}

// ---------- Wi-Fi ----------

// O próprio Windows responde com "netsh wlan show interfaces". A resposta vem em
// português (ou inglês), linha por linha: "SSID : MinhaRede", "Sinal : 100%"...
function lerWifi() {
  execFile('netsh', ['wlan', 'show', 'interfaces'], { windowsHide: true, timeout: 5000 }, (erro, saida) => {
    if (!janela) return;
    if (erro) return janela.webContents.send('wifi-mudou', { conectado: false });

    // Pega o valor de uma linha que começa com o nome dado (ex.: "SSID")
    const valorDe = (...nomes) => {
      for (const linha of saida.split('\n')) {
        const [nome, ...resto] = linha.split(':');
        if (nomes.includes(nome.trim())) return resto.join(':').trim();
      }
      return null;
    };

    const nome = valorDe('SSID');
    const sinal = parseInt(valorDe('Sinal', 'Signal'), 10);
    janela.webContents.send('wifi-mudou', {
      conectado: Boolean(nome),
      nome,
      sinal: Number.isNaN(sinal) ? 0 : sinal,
    });
  });
}

// ---------- Rádios (Wi-Fi e Bluetooth ligado/desligado) ----------

function ligarAjudanteRadios() {
  const aoReceber = (estado) => {
    janela.webContents.send('radios-mudaram', estado);
    lerWifi(); // ligou/desligou o Wi-Fi: atualiza o nome da rede na hora
  };
  ajudanteRadios = ligarAjudante('radios.py', aoReceber, (processo) => (ajudanteRadios = processo));
}

// Só esses comandos passam (a página não pode mandar qualquer coisa pro Python)
const COMANDOS_DE_RADIO = ['wifi:ligar', 'wifi:desligar', 'bluetooth:ligar', 'bluetooth:desligar'];

ipcMain.on('comando-radio', (_evento, comando) => {
  if (COMANDOS_DE_RADIO.includes(comando) && ajudanteRadios) ajudanteRadios.stdin.write(comando + '\n');
});

// Telas do Windows que a ilha pode abrir. São "endereços" especiais que o
// Windows entende, igual um link: ms-settings:... abre as Configurações.
const TELAS_DO_WINDOWS = {
  redes: 'ms-availablenetworks:', // a listinha de redes Wi-Fi
  bluetooth: 'ms-settings:bluetooth',
  energia: 'ms-settings:batterysaver',
};

ipcMain.on('abrir-tela', (_evento, nome) => {
  if (TELAS_DO_WINDOWS[nome]) shell.openExternal(TELAS_DO_WINDOWS[nome]);
});

// ---------- Recados vindos da página da ilha ----------

// Só mede o PC quando alguém vai ver: com a ilha aberta ou com um jogo rodando
// (aí a ilha fechada mostra GPU e temperatura). No resto do tempo, fica parado.
function atualizarMedidor() {
  const precisaMedir = ilhaAberta || jogoAberto !== null;
  if (precisaMedir && !medidorPc) {
    medirPc();
    medidorPc = setInterval(medirPc, 1500);
  } else if (!precisaMedir && medidorPc) {
    clearInterval(medidorPc);
    medidorPc = null;
  }
}

ipcMain.on('ilha-aberta', (_evento, aberta) => {
  ilhaAberta = aberta;
  atualizarMedidor();
});

// O mouse entrou/saiu da ilha: liga/desliga os cliques na janela
ipcMain.on('mouse-na-ilha', (_evento, estaDentro) => {
  janela.setIgnoreMouseEvents(!estaDentro, { forward: true });
});

ipcMain.on('comando-musica', (_evento, comando) => {
  if (ajudanteMusica) ajudanteMusica.stdin.write(comando + '\n');
});

// Botão direito na ilha: menuzinho
ipcMain.on('abrir-menu', () => {
  Menu.buildFromTemplate([
    { label: 'Recarregar a ilha', click: () => janela.reload() },
    { type: 'separator' },
    { label: 'Fechar a ilha', click: () => app.quit() },
  ]).popup({ window: janela });
});

// ---------- Liga e desliga ----------

app.whenReady().then(() => {
  criarJanela();
  // Espera a página da ilha carregar antes de mandar recados pra ela
  janela.webContents.once('did-finish-load', () => {
    ligarAjudanteMusica();
    ligarAjudanteJogos();
    ligarAjudanteRadios();
    lerWifi();
    setInterval(lerWifi, 10_000); // Wi-Fi muda pouco: olhar a cada 10 s basta
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  liberarEspaco(); // devolve a faixa do topo pras outras janelas
  if (ajudanteMusica) ajudanteMusica.kill();
  if (ajudanteJogos) ajudanteJogos.kill();
  if (ajudanteRadios) ajudanteRadios.kill();
});
