#!/usr/bin/env python3
"""
Actualiza data.json con el historico de loteriadominicana.com.do/Numbers/Old.

Que hace, en corto:
- Esa pagina muestra, para el dia/mes de HOY, los resultados de esa misma
  fecha en los ultimos 3 anos, para todas las loterias del sitio.
- Corriendo este script UNA VEZ AL DIA (via GitHub Actions, ver workflow.yml)
  durante un ano completo, terminas con el historico de 3 anos COMPLETO,
  sin tocar nada mas.
- Cada corrida solo AGREGA registros nuevos a data.json (nunca borra ni
  duplica): si un (fecha, loteria) ya existe, se ignora.

Como funciona el parseo:
- No depende de nombres de clases CSS (esas pueden cambiar en cualquier
  rediseno). En vez de eso, lee el TEXTO VISIBLE de la pagina en orden y
  reconoce el patron repetido: nombre de loteria -> numero -> "1ro" ->
  numero -> "2do" -> numero -> "3ro" -> fecha (dd-mm-aaaa).
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

URL = "https://www.loteriadominicana.com.do/Numbers/Old"
DATA_FILE = Path(__file__).parent / "data.json"

# Nombre en el sitio -> nombre que ya usa tu app (ver DEFAULT_SCHEDULE en
# script.js). Lo que no este en este diccionario se importa TAL CUAL viene
# del sitio (tu app acepta cualquier nombre de loteria, no hace falta que
# esten todas mapeadas para que funcione).
NAME_MAP = {
    "Loteria Nacional- Gana Más": "Nacional Gana Más",
    "Loteria Nacional- Noche": "Nacional Noche",
    "Quiniela Palé": "Quiniela Palé",
    "Quiniela Real": "Quiniela Real",
    "Quiniela Loteka": "Quiniela Loteka",
    "Quiniela La Primera": "La Primera",
    "Quiniela La Primera Noche": "La Primera Noche",
    "Quiniela La Suerte": "La Suerte",
    "Quiniela La Suerte 6PM": "La Suerte 6PM",
    "Quiniela Lotedom": "Lotedom",
    # Agregadas: estaban entrando "tal cual" (sin pasar por el mapa), lo
    # cual ya funcionaba, pero acá quedan documentadas explícitamente y se
    # les limpia el formato ("SXM- Quiniela Dia" -> "SXM Día") para que
    # sean consistentes con el resto de nombres cortos de la app.
    "New York Tarde": "New York Tarde",
    "New York Noche": "New York Noche",
    "Florida Tarde": "Florida Tarde",
    "Florida Noche": "Florida Noche",
    "Anguila 10AM": "Anguila 10AM",
    "Anguila 1PM": "Anguila 1PM",
    "Anguila 6PM": "Anguila 6PM",
    "Anguila 9PM": "Anguila 9PM",
    "SXM- Quiniela Dia": "SXM Día",
    "SXM- Quiniela Noche": "SXM Noche",
}


def fetch_text(source: str) -> str:
    """source puede ser una URL http(s) o la ruta a un archivo local (para pruebas)."""
    if source.startswith("http"):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        try:
            from bs4 import BeautifulSoup  # pip install beautifulsoup4
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            return soup.get_text("\n")
        except ImportError:
            print("Falta beautifulsoup4: pip install beautifulsoup4", file=sys.stderr)
            raise
    return Path(source).read_text(encoding="utf-8")


DATE_RE = re.compile(r"^\d{2}-\d{2}-\d{4}$")


def parse_records(text: str):
    """Recorre las lineas de texto en orden y arma los registros.
    Ignora todo lo que no siga exactamente el patron
    nombre -> num -> '1ro' -> num -> '2do' -> num -> '3ro' -> fecha.
    """
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]  # sin lineas vacias

    records = []
    i = 0
    while i < len(lines) - 6:
        # buscamos el patron: X, num, '1ro', num, '2do', num, '3ro', fecha
        if lines[i + 1] == "1ro" or (i + 2 < len(lines) and lines[i + 2] == "1ro"):
            pass
        # forma robusta: escaneamos buscando '1ro' como ancla
        i += 1

    # Segunda pasada, mas simple y confiable: anclar en '1ro'/'2do'/'3ro'.
    records = []
    n = len(lines)
    idx = 0
    while idx < n:
        if lines[idx] == "1ro" and idx >= 1:
            n1 = lines[idx - 1]
            # nombre de loteria: la linea justo antes del numero 1, siempre
            # que no sea ella misma un numero (evita falsos positivos)
            name_idx = idx - 2
            if name_idx < 0 or not n1.replace(".", "").isdigit():
                idx += 1
                continue
            name = lines[name_idx].lstrip("#").strip()
            # validamos que le siga el patron completo 2do/3ro/fecha
            if idx + 3 < n and lines[idx + 2] == "2do" and idx + 4 < n and lines[idx + 4] == "3ro":
                n2 = lines[idx + 1]
                n3 = lines[idx + 3]
                date_candidate = lines[idx + 5] if idx + 5 < n else ""
                if DATE_RE.match(date_candidate) and n1.isdigit() and n2.isdigit() and n3.isdigit():
                    dd, mm, yyyy = date_candidate.split("-")
                    records.append({
                        "date": f"{yyyy}-{mm}-{dd}",
                        "lottery": NAME_MAP.get(name, name),
                        "numbers": [n1.zfill(2), n2.zfill(2), n3.zfill(2)],
                    })
        idx += 1
    return records


def load_existing():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return []


def merge(existing, new_records):
    seen = {(r["date"], r["lottery"]) for r in existing}
    added = 0
    for r in new_records:
        key = (r["date"], r["lottery"])
        if key not in seen:
            existing.append(r)
            seen.add(key)
            added += 1
    return existing, added


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else URL
    text = fetch_text(source)
    new_records = parse_records(text)
    existing = load_existing()
    merged, added = merge(existing, new_records)
    merged.sort(key=lambda r: (r["date"], r["lottery"]))
    DATA_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Encontrados: {len(new_records)} | Nuevos agregados: {added} | Total en data.json: {len(merged)}")


if __name__ == "__main__":
    main()
