import numpy as np

from ocr.engine.schema import CellStyle, VisualCell
from ocr.engine.style_detector import detect_cell_style


def test_style_detector_reads_fill_and_border_colors():
    image = np.full((40, 60, 3), 255, dtype=np.uint8)
    image[5:35, 5:55] = [220, 240, 255]
    image[5:7, 5:55] = [10, 20, 30]
    image[33:35, 5:55] = [10, 20, 30]
    image[5:35, 5:7] = [10, 20, 30]
    image[5:35, 53:55] = [10, 20, 30]

    cell = VisualCell(row=0, column=0, x=5, y=5, width=50, height=30, style=CellStyle())
    style = detect_cell_style(image, cell)

    assert style["fillArgb"].startswith("FF")
    assert style["borders"]["top"]["color"] == "FF0A141E"
