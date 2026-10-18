"""Сборка веб-ассетов из сырых сканов (tools/assets/raw → packages/client/public).

Сырьё: официальные сканы из TTS-мода ikegami/tts_brass (через jiangshibiao/BrassBirmingham),
личное некоммерческое использование. Запуск: python tools/assets/build_assets.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'tools' / 'assets' / 'raw'
OUT = ROOT / 'packages' / 'client' / 'public'

# Поле: координаты в движке/клиенте — в системе оригинального скана 6144×6144.
# Обрезаем тёмные поля; клиент кладёт картинку в SVG по BOARD_CROP.
BOARD_CROP = (1000, 1000, 5180, 5180)
BOARD_OUT = 3000


def save(img: Image.Image, path: Path, quality: int = 85) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)


def build_board() -> None:
    board = Image.open(RAW / 'board.jpg').convert('RGB').crop(BOARD_CROP)
    save(board.resize((BOARD_OUT, BOARD_OUT), Image.LANCZOS), OUT / 'board.webp', 82)


def build_cards() -> None:
    manifest = json.loads((RAW / 'asset-manifest.json').read_text(encoding='utf8'))
    sheet = Image.open(RAW / 'cards-sheet.jpg').convert('RGB')
    cols, rows = manifest['cardSheet']['cols'], manifest['cardSheet']['rows']
    cw, ch = sheet.width / cols, sheet.height / rows
    done = set()
    for cell, name in manifest['cardSheet']['cells'].items():
        if name in done:
            continue
        done.add(name)
        i = int(cell)
        x, y = (i % cols) * cw, (i // cols) * ch
        card = sheet.crop((round(x), round(y), round(x + cw), round(y + ch)))
        save(card.resize((300, 421), Image.LANCZOS), OUT / 'cards' / f'{name}.webp')
    back = Image.open(RAW / 'cards' / 'back.png').convert('RGB')
    save(back.resize((300, 421), Image.LANCZOS), OUT / 'cards' / 'back.webp')


def copy_dir(name: str, size: int | None = None) -> None:
    for src in sorted((RAW / name).glob('*.png')):
        img = Image.open(src)
        img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if size:
            img = img.resize((size, size), Image.LANCZOS)
        save(img, OUT / name / f'{src.stem}.webp', 88)


def build_misc() -> None:
    for name in ('beer', 'link-canal', 'link-rail'):
        img = Image.open(RAW / f'{name}.png')
        img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
        save(img, OUT / 'ui' / f'{name}.webp', 90)


def main() -> None:
    build_board()
    build_cards()
    copy_dir('tiles')
    copy_dir('merchants')
    copy_dir('coins')
    copy_dir('players')
    build_misc()
    total = sum(p.stat().st_size for p in OUT.rglob('*.webp'))
    print(f'ok: {len(list(OUT.rglob("*.webp")))} файлов, {total / 1e6:.1f} МБ')


if __name__ == '__main__':
    main()
