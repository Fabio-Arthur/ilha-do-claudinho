# Parte da MÚSICA do ajudante da ilha (quem liga ela é o ajudante.py).
#
# O Windows tem um "controle de mídia" geral: é ele que aparece naquela caixinha
# quando você aperta as teclas de volume. Todo player que se registra nele
# (YouTube Music, Spotify, o navegador...) pode ser lido e controlado por aqui.
#
#   - avisa a ilha (enviar) sempre que a música muda
#   - comandos que chegam: "tocar_pausar", "proxima", "anterior" e "ir_para:SEGUNDOS"

import asyncio
import base64
import time

from winrt.windows.media.control import (
    GlobalSystemMediaTransportControlsSessionManager as GerenciadorDeMidia,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as StatusDoPlayer,
)
from winrt.windows.storage.streams import Buffer, DataReader, InputStreamOptions


def escolher_sessao(gerenciador):
    """Prefere o player que está TOCANDO; se nenhum estiver, pega o atual."""
    for sessao in gerenciador.get_sessions():
        if sessao.get_playback_info().playback_status == StatusDoPlayer.PLAYING:
            return sessao
    return gerenciador.get_current_session()


async def ler_capa(propriedades):
    """Lê a imagem da capa e transforma num texto (data URL) que o HTML entende."""
    if propriedades.thumbnail is None:
        return None
    try:
        arquivo = await propriedades.thumbnail.open_read_async()
        tamanho = arquivo.size
        buffer = await arquivo.read_async(Buffer(tamanho), tamanho, InputStreamOptions.READ_AHEAD)
        dados = bytearray(buffer.length)
        DataReader.from_buffer(buffer).read_bytes(dados)
        tipo = arquivo.content_type or "image/png"
        return f"data:{tipo};base64,{base64.b64encode(dados).decode()}"
    except Exception:
        return None  # sem capa não é motivo pra quebrar


async def executar_comando(sessao, comando):
    if sessao is None:
        return
    if comando == "tocar_pausar":
        await sessao.try_toggle_play_pause_async()
    elif comando == "proxima":
        await sessao.try_skip_next_async()
    elif comando == "anterior":
        await sessao.try_skip_previous_async()
    elif comando.startswith("ir_para:"):
        # O Windows conta o tempo em "ticks" de 100 nanossegundos (10 milhões por segundo)
        segundos = float(comando.split(":")[1])
        await sessao.try_change_playback_position_async(int(segundos * 10_000_000))


def ler_tempo(sessao):
    """Onde a música está e quanto ela dura (em segundos). None se o player não informar."""
    try:
        linha_do_tempo = sessao.get_timeline_properties()
        duracao = linha_do_tempo.end_time.total_seconds()
        if duracao <= 0:
            return None
        return {
            "posicao": linha_do_tempo.position.total_seconds(),
            "duracao": duracao,
            # Quando o player mediu essa posição: a ilha usa isso pra ir "andando" sozinha
            "medido_em": linha_do_tempo.last_updated_time.timestamp() * 1000,
        }
    except Exception:
        return None


async def rodar(enviar, comandos_pendentes):
    """enviar: função que manda um recado pra ilha | comandos_pendentes: fila de pedidos"""
    gerenciador = await GerenciadorDeMidia.request_async()

    ultimo_estado = None
    # A capa guardada: de qual música é, a imagem, quando a música trocou e quando lemos a capa
    capa_guardada = {"musica": None, "imagem": None, "trocou_em": 0, "lida_em": 0}

    while True:
        sessao = escolher_sessao(gerenciador)

        # 1) Faz o que a ilha pediu (play/pause, próxima...)
        while not comandos_pendentes.empty():
            await executar_comando(sessao, comandos_pendentes.get())

        # 2) Lê como a música está agora
        estado = {"tem_musica": False}
        if sessao is not None:
            try:
                propriedades = await sessao.try_get_media_properties_async()
                tocando = sessao.get_playback_info().playback_status == StatusDoPlayer.PLAYING
                musica = (propriedades.title, propriedades.artist)

                # Quando a música troca, o player avisa PRIMEIRO o nome e só um
                # pouquinho DEPOIS a capa nova. Se a gente lesse a capa uma vez só,
                # pegaria a da música anterior. Então:
                #   - nos 8 s depois da troca: relê a capa a cada 1 s (até a nova chegar)
                #   - depois disso: relê a cada 10 s, só por garantia
                agora = time.monotonic()
                if capa_guardada["musica"] != musica:
                    capa_guardada = {"musica": musica, "imagem": None, "trocou_em": agora, "lida_em": 0}

                acabou_de_trocar = agora - capa_guardada["trocou_em"] < 8
                tempo_desde_leitura = agora - capa_guardada["lida_em"]
                if (
                    capa_guardada["imagem"] is None
                    or (acabou_de_trocar and tempo_desde_leitura >= 1)
                    or tempo_desde_leitura >= 10
                ):
                    capa_nova = await ler_capa(propriedades)
                    capa_guardada["imagem"] = capa_nova or capa_guardada["imagem"]
                    capa_guardada["lida_em"] = agora

                estado = {
                    "tem_musica": bool(propriedades.title),
                    "titulo": propriedades.title,
                    "artista": propriedades.artist,
                    "tocando": tocando,
                    "capa": capa_guardada["imagem"],
                    "tempo": ler_tempo(sessao),
                }
            except Exception:
                pass  # o player fechou no meio da leitura: tenta de novo na próxima volta

        # 3) Só avisa a ilha se algo mudou
        if estado != ultimo_estado:
            enviar(estado)
            ultimo_estado = estado

        await asyncio.sleep(0.5)
