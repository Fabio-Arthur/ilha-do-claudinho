# Ajudante dos jogos da Ilha do Claudinho.
#
# A cada 3 segundos olha os programas abertos e descobre se algum é jogo.
# Como saber? Pelo LUGAR onde ele está instalado: jogos da Steam, Riot, Epic
# e Xbox sempre ficam em pastas com nomes conhecidos.
#
# Escreve (stdout) uma linha de JSON quando muda: {"jogo": "VALORANT"} ou {"jogo": null}

import json
import re
import time

import psutil

# Pastas onde os jogos moram. O pedaço entre parênteses ( ) é o nome do jogo.
PASTAS_DE_JOGOS = [
    r"\\steamapps\\common\\([^\\]+)\\",
    r"\\Riot Games\\([^\\]+)\\",
    r"\\Epic Games\\([^\\]+)\\",
    r"\\XboxGames\\([^\\]+)\\",
    r"\\GOG Galaxy\\Games\\([^\\]+)\\",
    r"\\EA Games\\([^\\]+)\\",
]

# Coisas que moram nessas pastas mas NÃO são jogo (launchers, ajudantes, anticheat...)
NAO_E_JOGO = re.compile(
    r"riot client|crash|report|easyanticheat|battleye|unins|redist|setup|launcher|helper|updater",
    re.IGNORECASE,
)


def procurar_jogo():
    """Devolve o nome do jogo aberto, ou None se não tiver nenhum."""
    for processo in psutil.process_iter(["exe"]):
        caminho = processo.info["exe"]
        if not caminho:
            continue  # programas do sistema escondem o caminho: com certeza não é jogo
        for pasta in PASTAS_DE_JOGOS:
            achou = re.search(pasta, caminho, re.IGNORECASE)
            if achou and not NAO_E_JOGO.search(caminho):
                return achou.group(1)
    return None


ultimo_jogo = "nada ainda"  # valor que nunca acontece, pra sempre avisar na primeira volta

while True:
    jogo = procurar_jogo()
    if jogo != ultimo_jogo:
        print(json.dumps({"jogo": jogo}), flush=True)
        ultimo_jogo = jogo
    time.sleep(3)
