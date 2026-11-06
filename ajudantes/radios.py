# Ajudante dos rádios da Ilha do Claudinho: Wi-Fi e Bluetooth.
#
# O Windows chama de "rádio" tudo que manda sinal sem fio. Pela mesma função
# dá pra ver se está ligado e ligar/desligar (é o que o botão das
# Configurações Rápidas faz).
#
# Como ele conversa com a ilha:
#   - ESCREVE (stdout): {"wifi": true/false/null, "bluetooth": true/false/null} quando muda
#     (null = o notebook não tem esse rádio)
#   - LÊ (stdin): "wifi:ligar", "wifi:desligar", "bluetooth:ligar", "bluetooth:desligar"

import asyncio
import json
import queue
import sys
import threading

from winrt.windows.devices.radios import Radio, RadioKind, RadioState

comandos_pendentes = queue.Queue()

# Nome que a ilha usa → tipo de rádio do Windows
TIPOS = {"wifi": RadioKind.WI_FI, "bluetooth": RadioKind.BLUETOOTH}


def escutar_comandos():
    for linha in sys.stdin:
        comandos_pendentes.put(linha.strip())


async def achar_radio(nome):
    for radio in await Radio.get_radios_async():
        if radio.kind == TIPOS[nome]:
            return radio
    return None


async def executar_comando(comando):
    nome, acao = comando.split(":")
    radio = await achar_radio(nome)
    if radio is not None:
        await radio.set_state_async(RadioState.ON if acao == "ligar" else RadioState.OFF)


async def ler_estado():
    estado = {}
    for nome in TIPOS:
        radio = await achar_radio(nome)
        estado[nome] = None if radio is None else radio.state == RadioState.ON
    return estado


async def main():
    await Radio.request_access_async()  # pede permissão pro Windows (só na primeira vez)
    threading.Thread(target=escutar_comandos, daemon=True).start()

    ultimo_estado = None
    while True:
        while not comandos_pendentes.empty():
            try:
                await executar_comando(comandos_pendentes.get())
            except Exception as erro:
                print(f"erro no comando: {erro}", file=sys.stderr, flush=True)

        estado = await ler_estado()
        if estado != ultimo_estado:
            print(json.dumps(estado), flush=True)
            ultimo_estado = estado

        await asyncio.sleep(1)


asyncio.run(main())
