# Ajudante da Ilha do Claudinho: UM programa Python só, que faz 5 trabalhos ao mesmo tempo.
#
# Antes eram programas separados (e cada um ocupava ~30 MB de RAM). Agora as
# partes (música, jogos, rádios, janela e clima) rodam juntas aqui dentro, revezando,
# com o asyncio: enquanto uma espera, a outra trabalha.
#
# Como ele conversa com a ilha (main.js):
#   - ESCREVE (stdout): uma linha de JSON por recado, dizendo de quem é:
#       {"tipo": "musica", "dados": {...}}
#   - LÊ (stdin): uma linha por comando, começando com o nome da parte:
#       "musica tocar_pausar"   "radios wifi:desligar"

import asyncio
import json
import queue
import sys
import threading

import clima
import janela
import jogos
import musica
import radios

# Uma fila de comandos pra cada parte que recebe comandos
filas = {"musica": queue.Queue(), "radios": queue.Queue()}


def escutar_comandos():
    """Roda numa thread separada: lê cada linha e coloca na fila da parte certa."""
    for linha in sys.stdin:
        parte, _, comando = linha.strip().partition(" ")
        if parte in filas:
            filas[parte].put(comando)


def criar_enviar(tipo):
    """Cria a função "enviar" de uma parte: ela já carimba de quem é o recado."""

    def enviar(dados):
        print(json.dumps({"tipo": tipo, "dados": dados}), flush=True)

    return enviar


async def main():
    threading.Thread(target=escutar_comandos, daemon=True).start()

    # gather = "roda tudo isso junto"
    await asyncio.gather(
        musica.rodar(criar_enviar("musica"), filas["musica"]),
        jogos.rodar(criar_enviar("jogos")),
        radios.rodar(criar_enviar("radios"), filas["radios"]),
        janela.rodar(criar_enviar("janela")),
        clima.rodar(criar_enviar("clima")),
    )


asyncio.run(main())
