# 🏝️ Ilha do Claudinho

Uma "ilha dinâmica" para o topo da tela do Windows, no estilo do iPhone,
com o Claudinho (um bonequinho em pixel art) morando nela.

## O que ela faz

- **Barra fechada:** relógio com segundos, data, Bluetooth, Wi-Fi e bateria.
  Com música tocando, mostra a capinha, o nome da música e uma linha do tempo
  estilo desenho animado, com um mini Claudinho correndo em cima.
- **Música:** capa, barra de progresso clicável e botões ⏮ ⏯ ⏭ para qualquer
  player que aparece no controle de mídia do Windows (YouTube Music, Spotify...).
  A ilha brilha com a cor da capa e o Claudinho dança.
- **PC:** uso de CPU, RAM, GPU e temperatura da placa de vídeo (NVIDIA).
- **Modo foco gamer:** abriu um jogo da Steam, Riot, Epic, Xbox, GOG ou EA, a
  ilha esconde Wi-Fi/bateria e, mesmo fechada, mostra GPU, temperatura, CPU e
  RAM (amarelo/vermelho quando esquenta).
- **Abre junto com o Windows:** liga/desliga no botão direito da ilha, ou
  `npm run iniciar-com-windows`.
- **Conexões:** liga/desliga Wi-Fi e Bluetooth e atalhos para as telas do Windows.

## Como rodar

Precisa de Windows 10/11, [Node.js](https://nodejs.org) e [Python 3](https://python.org).

```bash
npm install
python -m venv ajudantes/.venv
ajudantes/.venv/Scripts/python -m pip install -r ajudantes/requirements.txt
npm start
```

> Rodando pelo terminal do VS Code? Ele liga a variável `ELECTRON_RUN_AS_NODE`,
> que quebra o Electron. Use um terminal comum.

Para fechar: botão direito na ilha → **Fechar a ilha**.

## Como é feita

| Parte | O que faz |
| --- | --- |
| `main.js` | Bastidor do Electron: a janela transparente no topo e os recados |
| `preload.js` | Ponte entre a página e o bastidor |
| `ilha/` | O visual: HTML, CSS e JS da ilha |
| `ajudantes/ajudante.py` | Um Python só que roda as 3 partes abaixo juntas (economiza RAM) |
| `ajudantes/musica.py` | Lê e controla a música pelo Windows |
| `ajudantes/jogos.py` | Descobre se tem jogo aberto |
| `ajudantes/radios.py` | Liga/desliga Wi-Fi e Bluetooth |
| `ajudantes/janela.py` | Vê se o programa em uso cobre o topo (aí a ilha vira um relevinho) |
| `espaco-reservado.js` | Reserva uma faixa no topo da tela (desligado por padrão) |
| `ferramentas/montar-icones.js` | Junta os ícones usados num arquivo só (`npm run icones`) |

Ícones: [Lucide](https://lucide.dev) (licença ISC).
