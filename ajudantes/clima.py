# Parte do CLIMA do ajudante da ilha (quem liga ela é o ajudante.py).
#
# 1. Pergunta pro Windows onde o notebook está (a mesma "Localização" que o
#    app Clima e o Mapas usam). Precisa estar ligada nas Configurações.
# 2. Com a posição, pede a previsão pro Open-Meteo (grátis, sem cadastro).
# 3. Descobre o nome da cidade pelo OpenStreetMap (só pra mostrar na aba).
#
# A posição é arredondada pra 2 casas (~1 km): pro clima é mais que suficiente,
# e assim o endereço exato nunca sai do notebook.
#
#   - avisa a ilha: {"cidade", "agora": {...}, "hoje": {...}, "horas": [...]}
#     ou {"erro": "sem-localizacao" / "sem-internet"}

import asyncio
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime

from winrt.windows.devices.geolocation import GeolocationAccessStatus, Geolocator

A_CADA = 15 * 60  # previsão nova a cada 15 minutos
SE_DEU_ERRO = 60  # sem internet/localização: tenta de novo em 1 minuto
QUANTAS_HORAS = 4  # quantas "próximas horas" a aba mostra

# Nome que os sites pedem pra saber quem está perguntando (sem dado pessoal)
QUEM_PERGUNTA = {"User-Agent": "IlhaDoClaudinho/0.1 (github.com/Fabio-Arthur/ilha-do-claudinho)"}


def baixar_json(endereco, parametros):
    """Pede uma página da internet e devolve o JSON dela (isso trava: roda numa thread)."""
    pedido = urllib.request.Request(endereco + "?" + urllib.parse.urlencode(parametros), headers=QUEM_PERGUNTA)
    with urllib.request.urlopen(pedido, timeout=15) as resposta:
        return json.load(resposta)


async def onde_estou():
    """Devolve (latitude, longitude) arredondadas, ou None se a Localização estiver desligada."""
    if await Geolocator.request_access_async() != GeolocationAccessStatus.ALLOWED:
        return None
    posicao = (await Geolocator().get_geoposition_async()).coordinate.point.position
    return round(posicao.latitude, 2), round(posicao.longitude, 2)


def nome_da_cidade(latitude, longitude):
    endereco = baixar_json(
        "https://nominatim.openstreetmap.org/reverse",
        {"lat": latitude, "lon": longitude, "format": "jsonv2", "zoom": 10, "accept-language": "pt-BR"},
    ).get("address", {})
    return endereco.get("city") or endereco.get("town") or endereco.get("village") or endereco.get("municipality")


def previsao(latitude, longitude):
    dados = baixar_json(
        "https://api.open-meteo.com/v1/forecast",
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,apparent_temperature,weather_code,is_day",
            "hourly": "temperature_2m,weather_code,precipitation_probability,is_day",
            "daily": "temperature_2m_min,temperature_2m_max,precipitation_probability_max",
            "timezone": "auto",  # as horas já vêm no fuso de onde você está
            "forecast_days": 2,  # hoje + amanhã: perto da meia-noite as "próximas horas" já são de amanhã
        },
    )
    agora = dados["current"]
    horas = dados["hourly"]
    dia = dados["daily"]

    # As horas vêm do dia inteiro (00:00, 01:00...): pula as que já passaram.
    # Ex.: agora 21:15 → a primeira é a das 22:00.
    hora_atual = agora["time"][:13]  # "2026-11-06T21"
    comeco = next(i for i, hora in enumerate(horas["time"]) if hora[:13] > hora_atual)

    return {
        "agora": {
            "temperatura": agora["temperature_2m"],
            "sensacao": agora["apparent_temperature"],
            "codigo": agora["weather_code"],
            "de_dia": bool(agora["is_day"]),
        },
        "hoje": {
            "minima": dia["temperature_2m_min"][0],
            "maxima": dia["temperature_2m_max"][0],
            "chuva": dia["precipitation_probability_max"][0],
        },
        "horas": [
            {
                "hora": horas["time"][i][11:13] + "h",  # "2026-11-06T22:00" → "22h"
                "temperatura": horas["temperature_2m"][i],
                "codigo": horas["weather_code"][i],
                "de_dia": bool(horas["is_day"][i]),
                "chuva": horas["precipitation_probability"][i],
            }
            for i in range(comeco, comeco + QUANTAS_HORAS)
        ],
        "atualizado": datetime.now().strftime("%H:%M"),
    }


async def rodar(enviar):
    cidade = None
    lugar_da_cidade = None  # a cidade só é procurada de novo se você mudar de lugar

    while True:
        try:
            lugar = await onde_estou()
            if lugar is None:
                enviar({"erro": "sem-localizacao"})
                await asyncio.sleep(SE_DEU_ERRO)
                continue

            # to_thread = baixa numa thread separada, pra não travar música/jogos enquanto espera
            tempo = await asyncio.to_thread(previsao, *lugar)
            if lugar != lugar_da_cidade:
                try:
                    cidade = await asyncio.to_thread(nome_da_cidade, *lugar)
                    lugar_da_cidade = lugar
                except Exception:
                    pass  # sem nome de cidade a aba funciona igual

            enviar({"cidade": cidade, **tempo})
            await asyncio.sleep(A_CADA)
        except Exception as erro:
            print(f"erro no clima: {erro}", file=sys.stderr, flush=True)
            enviar({"erro": "sem-internet"})
            await asyncio.sleep(SE_DEU_ERRO)
