import shutil

import pytesseract

from .config import OcrConfig
from .schema import OcrWord


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def extract_ocr_words(image, page_number: int, dpi: int, config: OcrConfig) -> list[OcrWord]:
    data = pytesseract.image_to_data(
        image,
        lang=config.languages,
        config=config.build_tesseract_config(),
        output_type=pytesseract.Output.DICT,
    )

    words: list[OcrWord] = []
    for index, text in enumerate(data.get("text", [])):
        raw_text = str(text or "").strip()
        confidence = float(data["conf"][index]) if str(data["conf"][index]).strip() else -1.0
        width_px = int(data["width"][index] or 0)
        height_px = int(data["height"][index] or 0)

        if not raw_text or confidence < config.min_confidence or width_px <= 0 or height_px <= 0:
            continue

        x_px = int(data["left"][index] or 0)
        y_px = int(data["top"][index] or 0)
        x = px_to_pt(x_px, dpi)
        y = px_to_pt(y_px, dpi)
        width = px_to_pt(width_px, dpi)
        height = px_to_pt(height_px, dpi)

        words.append(OcrWord(
            id=f"ocr:{page_number}:{len(words)}",
            pageNumber=page_number,
            index=len(words),
            text=raw_text,
            rawText=raw_text,
            x=x,
            y=y,
            width=width,
            height=height,
            right=x + width,
            bottom=y + height,
            fontSize=max(5.0, height * 0.78),
            ocrConfidence=confidence,
            blockNumber=int(data["block_num"][index] or 0),
            paragraphNumber=int(data["par_num"][index] or 0),
            lineNumber=int(data["line_num"][index] or 0),
            wordNumber=int(data["word_num"][index] or 0),
        ))

    return words


def px_to_pt(value: float, dpi: int) -> float:
    return float(value) * 72.0 / float(dpi)
