// Reserva uma faixa no topo da tela pra ilha, igual o painel do Pop!_OS.
//
// O Windows chama isso de "AppBar": é o mesmo jeito que a barra de tarefas usa
// pra avisar "esse pedaço da tela é meu". Aí as janelas maximizadas começam
// embaixo da faixa, em vez de ficar por baixo da ilha.
//
// A função do Windows (SHAppBarMessage) mora numa DLL, e o JavaScript não fala
// com DLL sozinho. O "koffi" é o tradutor entre os dois.

const koffi = require('koffi');

// Pedidos que dá pra fazer pro SHAppBarMessage (números definidos pelo Windows)
const NOVA_BARRA = 0; // ABM_NEW: "quero ser uma barra"
const REMOVER_BARRA = 1; // ABM_REMOVE: "não sou mais barra, devolve o espaço"
const PERGUNTAR_POSICAO = 2; // ABM_QUERYPOS: "posso ficar aqui?"
const DEFINIR_POSICAO = 3; // ABM_SETPOS: "então fico aqui"
const BORDA_DE_CIMA = 1; // ABE_TOP

// O "formulário" que o Windows espera receber, campo por campo
const RETANGULO = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
const DADOS_DA_BARRA = koffi.struct('APPBARDATA', {
  cbSize: 'uint32',
  hWnd: 'intptr_t',
  uCallbackMessage: 'uint32',
  uEdge: 'uint32',
  rc: RETANGULO,
  lParam: 'intptr_t',
});

const SHAppBarMessage = koffi
  .load('shell32.dll')
  .func('uintptr_t __stdcall SHAppBarMessage(uint32_t pedido, _Inout_ APPBARDATA *dados)');

let dadosAtuais = null;

// janela: a BrowserWindow da ilha | tela: a tela onde ela está | altura: em pixels "do CSS"
function reservarEspaco(janela, tela, altura) {
  // O Windows conta em pixels de verdade. Com zoom de 125%, 36px do CSS viram 45px reais.
  const escala = tela.scaleFactor;
  const limites = tela.bounds;

  dadosAtuais = {
    cbSize: koffi.sizeof(DADOS_DA_BARRA),
    hWnd: janela.getNativeWindowHandle().readBigUInt64LE(0), // o "RG" da janela no Windows
    uCallbackMessage: 0x0401, // um número qualquer pra recados do Windows (a gente não usa)
    uEdge: BORDA_DE_CIMA,
    rc: {
      left: Math.round(limites.x * escala),
      top: Math.round(limites.y * escala),
      right: Math.round((limites.x + limites.width) * escala),
      bottom: Math.round((limites.y + altura) * escala),
    },
    lParam: 0,
  };

  SHAppBarMessage(NOVA_BARRA, dadosAtuais);
  SHAppBarMessage(PERGUNTAR_POSICAO, dadosAtuais); // o Windows pode ajustar o retângulo
  dadosAtuais.rc.bottom = dadosAtuais.rc.top + Math.round(altura * escala);
  SHAppBarMessage(DEFINIR_POSICAO, dadosAtuais);
}

// IMPORTANTE: chamar ao fechar, senão o espaço fica "preso" até reiniciar o Explorer
function liberarEspaco() {
  if (!dadosAtuais) return;
  SHAppBarMessage(REMOVER_BARRA, dadosAtuais);
  dadosAtuais = null;
}

module.exports = { reservarEspaco, liberarEspaco };
