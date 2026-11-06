# Parte da JANELA do ajudante da ilha (quem liga ela é o ajudante.py).
#
# Descobre se o programa que você está usando agora ocupa o topo da tela,
# bem onde a ilha fica (ex.: VS Code ou navegador maximizado). Se ocupa, a
# ilha encolhe e vira só um "relevinho" pra não atrapalhar.
#
# Avisa a ilha quando muda: {"coberta": True} ou {"coberta": False}

import asyncio
import ctypes
import ctypes.wintypes

import psutil

user32 = ctypes.windll.user32

# Pede as medidas em pixels DE VERDADE (com zoom de 125%, o Windows
# "mentiria" os números pra programas antigos)
user32.SetProcessDPIAware()

# Até quantos pixels do topo uma janela precisa chegar pra "cobrir" a ilha
ALTURA_DA_ILHA = 48

# Janelas que não contam: a área de trabalho e a barra de tarefas
NAO_CONTAM = {"Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd"}


def janela_cobre_a_ilha():
    janela = user32.GetForegroundWindow()  # a janela que você está usando agora
    if not janela or user32.IsIconic(janela):  # IsIconic = minimizada
        return False

    classe = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(janela, classe, 256)
    if classe.value in NAO_CONTAM:
        return False

    # A própria ilha não conta (ex.: quando o menu do botão direito está aberto)
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(janela, ctypes.byref(pid))
    try:
        if "ilha-do-claudinho" in psutil.Process(pid.value).exe():
            return False
    except psutil.Error:
        pass

    # Onde a janela está: ela chega no topo E passa pelo meio da tela?
    caixa = ctypes.wintypes.RECT()
    user32.GetWindowRect(janela, ctypes.byref(caixa))
    meio_da_tela = user32.GetSystemMetrics(0) // 2  # 0 = largura da tela
    return caixa.top <= ALTURA_DA_ILHA and caixa.left < meio_da_tela < caixa.right


async def rodar(enviar):
    ultima_resposta = None
    while True:
        coberta = janela_cobre_a_ilha()
        if coberta != ultima_resposta:
            enviar({"coberta": coberta})
            ultima_resposta = coberta
        await asyncio.sleep(0.4)
