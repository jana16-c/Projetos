from pathlib import Path

import pypdfium2 as pdfium

from .schema import RenderedPage


def render_pdf_page(pdf_path: str | Path, page_number: int, dpi: int = 300) -> RenderedPage:
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF nao encontrado: {pdf_path}")

    document = pdfium.PdfDocument(str(pdf_path))
    if page_number < 1 or page_number > len(document):
        raise ValueError(f"Pagina {page_number} fora do intervalo do PDF.")

    page = document[page_number - 1]
    scale = dpi / 72.0
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil().convert("RGB")

    return RenderedPage(
        image=image,
        page_number=page_number,
        width_px=image.width,
        height_px=image.height,
        width_pt=image.width * 72.0 / dpi,
        height_pt=image.height * 72.0 / dpi,
        dpi=dpi,
    )
