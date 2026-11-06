# Parte dos RÁDIOS do ajudante da ilha: Wi-Fi e Bluetooth (quem liga ela é o ajudante.py).
#
# O Windows chama de "rádio" tudo que manda sinal sem fio. Pela mesma função
# dá pra ver se está ligado e ligar/desligar (é o que o botão das
# Configurações Rápidas faz).
#
#   - avisa a ilha quando muda: {"wifi": True/False/None, "bluetooth": True/False/None}
#     (None = o notebook não tem esse rádio)
#   - comandos que chegam: "wifi:ligar", "wifi:desligar", "bluetooth:ligar", "bluetooth:desligar"

import asyncio
import sys

from winrt.windows.devices.radios import Radio, RadioKind, RadioState

# Nome que a ilha usa → tipo de rádio do Windows
TIPOS = {"wifi": RadioKind.WI_FI, "bluetooth": RadioKind.BLUETOOTH}


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


async def rodar(enviar, comandos_pendentes):
    await Radio.request_access_async()  # pede permissão pro Windows (só na primeira vez)

    ultimo_estado = None
    while True:
        while not comandos_pendentes.empty():
            try:
                await executar_comando(comandos_pendentes.get())
            except Exception as erro:
                print(f"erro no comando: {erro}", file=sys.stderr, flush=True)

        estado = await ler_estado()
        if estado != ultimo_estado:
            enviar(estado)
            ultimo_estado = estado

        await asyncio.sleep(1)
