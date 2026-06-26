from PIL import Image, ImageDraw

from ocr.engine.grid_detector import build_visual_tables
from ocr.engine.line_detector import detect_lines
from ocr.engine.preprocess import prepare_line_image


def test_grid_detector_builds_3x3_table():
    image = Image.new("RGB", (300, 300), "white")
    draw = ImageDraw.Draw(image)

    for y in (30, 110, 190, 270):
        draw.line((30, y, 270, y), fill="black", width=3)

    for x in (30, 110, 190, 270):
        draw.line((x, 30, x, 270), fill="black", width=3)

    binary = prepare_line_image(image)
    horizontal, vertical = detect_lines(binary, dpi=300)
    tables = build_visual_tables(horizontal, vertical)

    assert len(tables) == 1
    assert tables[0].rows == 3
    assert tables[0].columns == 3
    assert len(tables[0].cells) == 9
