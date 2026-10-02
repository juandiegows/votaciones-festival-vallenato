"""Genera muestras instrumentales ORIGINALES (sintetizadas) para las canciones ficticias de prueba.

Acordeón (osciladores con armónicos y trémolo), caja (golpes graves) y guacharaca (ruido raspado),
con tempo y patrón rítmico según el aire: paseo, merengue, puya o son.
"""
import os

import numpy as np
from scipy.io import wavfile

SR = 22050
DURACION = 22.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wav")
os.makedirs(OUT, exist_ok=True)

AIRES = {  # bpm, subdivisiones por pulso, patrón de caja (1 = golpe) por compás de 8 subdivisiones
    "paseo":    dict(bpm=104, sub=2, caja=[1, 0, 0, 1, 1, 0, 0, 1], guacha=[1, 1, 1, 1, 1, 1, 1, 1]),
    "merengue": dict(bpm=118, sub=3, caja=[1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], guacha=[1, 1, 1] * 4),
    "puya":     dict(bpm=150, sub=2, caja=[1, 1, 0, 1, 1, 1, 0, 1], guacha=[1, 1, 1, 1, 1, 1, 1, 1]),
    "son":      dict(bpm=84,  sub=2, caja=[1, 0, 0, 0, 1, 0, 1, 0], guacha=[1, 0, 1, 1, 1, 0, 1, 1]),
}

CANCIONES = [  # archivo, aire, tónica (Hz), semilla
    ("brisas-del-guatapuri", "paseo", 220.00, 11),
    ("luna-de-valledupar", "merengue", 246.94, 12),
    ("el-pilon-de-mi-tierra", "puya", 261.63, 13),
    ("sabanas-del-cesar", "son", 196.00, 14),
    ("caminos-de-la-sierra", "paseo", 233.08, 15),
    ("corazon-sabanero", "paseo", 207.65, 21),
    ("recuerdos-de-mi-pueblo", "son", 220.00, 22),
    ("la-brisa-y-el-acordeon", "merengue", 261.63, 23),
    ("cantor-de-mi-tierra", "puya", 246.94, 24),
]

MAYOR = [0, 2, 4, 5, 7, 9, 11, 12]
ACORDES = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]]  # I – IV – V – I


def nota(freq, dur, vol=0.25):
    t = np.arange(int(SR * dur)) / SR
    tremolo = 1 + 0.06 * np.sin(2 * np.pi * 5.5 * t)
    onda = sum((1 / k) * np.sin(2 * np.pi * freq * k * t) * (0.9 if k % 2 else 0.6) for k in range(1, 8))
    onda += 0.5 * sum((1 / k) * np.sin(2 * np.pi * freq * 1.004 * k * t) for k in range(1, 6))  # lengüeta desafinada
    env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.05).clip(0, 1)
    return vol * onda * tremolo * env / 3


def golpe_caja(rng, grave=True):
    dur = 0.18
    t = np.arange(int(SR * dur)) / SR
    tono = np.sin(2 * np.pi * (140 if grave else 230) * t * (1 - 0.4 * t))
    ruido = rng.normal(0, 1, t.size) * 0.3
    return (tono + ruido) * np.exp(-t * 28) * 0.55


def raspado(rng, dur):
    t = np.arange(int(SR * dur)) / SR
    ruido = rng.normal(0, 1, t.size)
    ruido = np.diff(np.concatenate([[0], ruido]))  # filtro paso alto simple
    rasp = 1 + 0.8 * np.sign(np.sin(2 * np.pi * 70 * t))
    return ruido * rasp * np.exp(-t * 18) * 0.06


def mezclar(destino, señal, inicio):
    a = int(inicio * SR)
    b = min(destino.size, a + señal.size)
    if a < destino.size:
        destino[a:b] += señal[: b - a]


def cancion(aire, tonica, semilla):
    rng = np.random.default_rng(semilla)
    cfg = AIRES[aire]
    paso = 60 / cfg["bpm"] / cfg["sub"]
    total = np.zeros(int(SR * DURACION))
    patron_len = len(cfg["caja"])
    pasos = int(DURACION / paso)

    # melodía: frases de 8 pasos que se repiten con variación
    frase = [rng.choice(MAYOR[:6]) for _ in range(patron_len)]
    for i in range(pasos):
        tiempo = i * paso
        compas = i // patron_len
        acorde = ACORDES[compas % len(ACORDES)]
        if i % patron_len == 0 and compas % 2 == 1:
            frase = [g if rng.random() > 0.35 else rng.choice(MAYOR) for g in frase]
        grado = frase[i % patron_len] + (acorde[0] if rng.random() > 0.5 else 0)
        if rng.random() > 0.15:
            f = tonica * 2 ** (grado / 12) * 2
            mezclar(total, nota(f, paso * (2 if rng.random() > 0.7 else 1) * 0.95), tiempo)
        if i % cfg["sub"] == 0:  # bajos del acordeón
            mezclar(total, nota(tonica / 2 * 2 ** (acorde[0] / 12), paso * 0.9, vol=0.18), tiempo)
            for g in acorde[1:]:
                mezclar(total, nota(tonica * 2 ** (g / 12), paso * 0.6, vol=0.07), tiempo + paso * 0.5)
        if cfg["caja"][i % patron_len]:
            mezclar(total, golpe_caja(rng, grave=(i % patron_len) % 4 == 0), tiempo)
        if cfg["guacha"][i % len(cfg["guacha"])]:
            mezclar(total, raspado(rng, paso * 0.9), tiempo)

    t = np.arange(total.size) / SR
    total *= np.minimum(1, t / 1.0) * np.minimum(1, (DURACION - t) / 2.0)  # entrada y salida suaves
    total /= np.max(np.abs(total)) * 1.1
    return (total * 32767).astype(np.int16)


for archivo, aire, tonica, semilla in CANCIONES:
    wavfile.write(os.path.join(OUT, archivo + ".wav"), SR, cancion(aire, tonica, semilla))
    print("ok", archivo, aire)
