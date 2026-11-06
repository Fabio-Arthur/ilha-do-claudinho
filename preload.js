// "Ponte" entre a página da ilha e o bastidor (main.js).
// A página não pode mexer no Windows direto (segurança); ela só usa o que está aqui.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ilha', {
  mouseNaIlha: (estaDentro) => ipcRenderer.send('mouse-na-ilha', estaDentro),
  avisarAberta: (aberta) => ipcRenderer.send('ilha-aberta', aberta),
  comandoMusica: (comando) => ipcRenderer.send('comando-musica', comando),
  abrirMenu: () => ipcRenderer.send('abrir-menu'),
  quandoMusicaMudar: (funcao) => ipcRenderer.on('musica-mudou', (_evento, estado) => funcao(estado)),
  quandoPcMudar: (funcao) => ipcRenderer.on('pc-mudou', (_evento, medidas) => funcao(medidas)),
  comandoRadio: (comando) => ipcRenderer.send('comando-radio', comando),
  abrirTela: (nome) => ipcRenderer.send('abrir-tela', nome),
  quandoRadiosMudarem: (funcao) => ipcRenderer.on('radios-mudaram', (_evento, estado) => funcao(estado)),
  quandoWifiMudar:(funcao) => ipcRenderer.on('wifi-mudou', (_evento, wifi) => funcao(wifi)),
  quandoJogoMudar:(funcao) => ipcRenderer.on('jogo-mudou', (_evento, jogo) => funcao(jogo)),
});
