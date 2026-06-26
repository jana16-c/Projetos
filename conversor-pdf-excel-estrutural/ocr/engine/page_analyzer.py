from pathlib import Path

import numpy as np

from .config import OcrConfig
from .grid_detector import build_visual_tables
from .line_detector import detect_lines
from .preprocess import prepare_line_image, prepare_ocr_image
from .renderer import render_pdf_page
from .style_detector import detect_cell_style
from .tesseract_engine import extract_ocr_words, tesseract_available


def analyze_pdf_page(
    pdf_path: str | Path,
    page_number: int,
    dpi: int = 300,
    languages: str = "por+eng",
    min_confidence: float = 45.0,
):
    rendered = render_pdf_page(pdf_path, page_number, dpi=dpi)
    return analyze_page_image(
        rendered.image,
        page_number=page_number,
        dpi=dpi,
        languages=languages,
        min_confidence=min_confidence,
    )


def analyze_page_image(image, page_number: int, dpi: int = 300, languages: str = "por+eng", min_confidence: float = 45.0):
    config = OcrConfig(dpi=dpi, languages=languages, min_confidence=min_confidence)
    ocr_image = prepare_ocr_image(image)
    line_binary = prepare_line_image(image)
    horizontal_lines, vertical_lines = detect_lines(line_binary, dpi)
    visual_tables = build_visual_tables(horizontal_lines, vertical_lines)
    image_array = np.array(image)
    scale = dpi / 72.0

    for table in visual_tables:
        for cell in table.cells:
            detected_style = detect_cell_style(image_array, cell, scale=scale)
            cell.style.fillArgb = detected_style["fillArgb"]
            cell.style.borders = detected_style["borders"]

    ocr_words = []
    warnings = []
    if tesseract_available():
        ocr_words = [word.to_dict() for word in extract_ocr_words(ocr_image, page_number, dpi, config)]
    else:
        warnings.append("Tesseract nao encontrado. OCR indisponivel nesta maquina.")

    return {
        "pageNumber": page_number,
        "dpi": dpi,
        "languages": languages,
        "ocrWords": ocr_words,
        "horizontalLines": [line.to_dict() for line in horizontal_lines],
        "verticalLines": [line.to_dict() for line in vertical_lines],
        "visualTables": [table.to_dict() for table in visual_tables],
        "warnings": warnings,
    }
