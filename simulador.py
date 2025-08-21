import pygame
import math
import random

# Inicialização do Pygame
pygame.init()
LARG, ALT = 900, 600
tela = pygame.display.set_mode((LARG, ALT))
pygame.display.set_caption("Simulador de Óptica Geométrica - Espelhos Planos (Gamificado)")

# Cores
PRETO = (0, 0, 0)
BRANCO = (255, 255, 255)
AZUL = (80, 180, 255)
VERDE = (0, 255, 0)
VERMELHO = (255, 80, 80)
AMARELO = (255, 255, 100)
CINZA = (180, 180, 180)
ROXO = (180, 80, 255)

# Parâmetros do espelho
espelho_x1, espelho_y1 = 200, 150
espelho_x2, espelho_y2 = 700, 150

# Posição do objeto (ponto luminoso)
obj_x, obj_y = 350, 400

# Gamificação: alvo virtual
def novo_alvo():
    # Gera um alvo na região acima do espelho, para ser atingido pela imagem virtual
    x = random.randint(espelho_x1 + 60, espelho_x2 - 60)
    y = random.randint(40, espelho_y1 - 60)
    return x, y

alvo_x, alvo_y = novo_alvo()
pontos = 0
tentativas = 0
acertou = False

# Função para calcular o ponto de reflexão
def refletir_ponto(px, py, x1, y1, x2, y2):
    # Reflete o ponto (px, py) em relação à reta (x1,y1)-(x2,y2)
    dx = x2 - x1
    dy = y2 - y1
    a = dy
    b = -dx
    c = dx * y1 - dy * x1
    d = (a * px + b * py + c) / (a**2 + b**2)
    rx = px - 2 * a * d
    ry = py - 2 * b * d
    return rx, ry

def desenha_espelho():
    pygame.draw.line(tela, CINZA, (espelho_x1, espelho_y1), (espelho_x2, espelho_y2), 8)
    fonte = pygame.font.SysFont(None, 24)
    tela.blit(fonte.render("Espelho Plano", True, CINZA), (espelho_x1+180, espelho_y1-30))

def desenha_objeto():
    pygame.draw.circle(tela, VERMELHO, (obj_x, obj_y), 10)
    fonte = pygame.font.SysFont(None, 24)
    tela.blit(fonte.render("Objeto", True, VERMELHO), (obj_x-30, obj_y+18))

def desenha_imagem(img_x, img_y):
    pygame.draw.circle(tela, AZUL, (int(img_x), int(img_y)), 10, 2)
    fonte = pygame.font.SysFont(None, 24)
    tela.blit(fonte.render("Imagem", True, AZUL), (int(img_x)-30, int(img_y)+18))

def desenha_raios(img_x, img_y):
    # Raio incidente
    pygame.draw.line(tela, AMARELO, (obj_x, obj_y), (espelho_x1+100, espelho_y1), 2)
    # Raio refletido
    pygame.draw.line(tela, VERDE, (espelho_x1+100, espelho_y1), (int(img_x), int(img_y)), 2)
    # Linha tracejada do prolongamento do raio refletido (imagem virtual)
    for i in range(0, 100, 10):
        x = espelho_x1+100 + (img_x - (espelho_x1+100)) * i / 100
        y = espelho_y1 + (img_y - espelho_y1) * i / 100
        pygame.draw.circle(tela, AZUL, (int(x), int(y)), 2)

def desenha_alvo():
    pygame.draw.circle(tela, ROXO, (alvo_x, alvo_y), 14)
    pygame.draw.circle(tela, BRANCO, (alvo_x, alvo_y), 7)
    fonte = pygame.font.SysFont(None, 24)
    tela.blit(fonte.render("Alvo", True, ROXO), (alvo_x-20, alvo_y-32))

def desenha_interface():
    fonte = pygame.font.SysFont(None, 22)
    tela.blit(fonte.render("Arraste o objeto vermelho para alinhar a IMAGEM (azul) com o ALVO!", True, BRANCO), (20, ALT-40))
    tela.blit(fonte.render(f"Pontos: {pontos}   Tentativas: {tentativas}", True, AMARELO), (20, 20))
    if acertou:
        tela.blit(fonte.render("Parabéns! Você acertou o alvo! Clique para novo desafio.", True, VERDE), (LARG//2-220, ALT-80))

def main():
    global obj_x, obj_y, alvo_x, alvo_y, pontos, tentativas, acertou
    relogio = pygame.time.Clock()
    arrastando = False

    while True:
        tela.fill(PRETO)
        desenha_espelho()
        desenha_objeto()

        # Calcula imagem virtual
        img_x, img_y = refletir_ponto(obj_x, obj_y, espelho_x1, espelho_y1, espelho_x2, espelho_y2)
        desenha_imagem(img_x, img_y)
        desenha_raios(img_x, img_y)
        desenha_alvo()
        desenha_interface()

        for evento in pygame.event.get():
            if evento.type == pygame.QUIT:
                pygame.quit()
                return
            elif evento.type == pygame.MOUSEBUTTONDOWN:
                mx, my = pygame.mouse.get_pos()
                if acertou:
                    # Novo desafio
                    alvo_x, alvo_y = novo_alvo()
                    acertou = False
                elif (mx-obj_x)**2 + (my-obj_y)**2 < 15**2:
                    arrastando = True
            elif evento.type == pygame.MOUSEBUTTONUP:
                arrastando = False
            elif evento.type == pygame.MOUSEMOTION and arrastando:
                mx, my = pygame.mouse.get_pos()
                obj_x, obj_y = mx, my

        # Checagem gamificada: imagem virtual sobre o alvo
        if not acertou and (img_x - alvo_x)**2 + (img_y - alvo_y)**2 < 18**2:
            pontos += 1
            tentativas += 1
            acertou = True
        elif not acertou and arrastando:
            tentativas += 0  # Só conta tentativa ao acertar

        pygame.display.flip()
        relogio.tick(60)

if __name__ == "__main__":
    main()