import cv2

from .schema import LineSegment
from .tesseract_engine import px_to_pt


def detect_lines(binary_image, dpi: int) -> tuple[list[LineSegment], list[LineSegment]]:
    horizontal_size = max(15, binary_image.shape[1] // 30)
    vertical_size = max(15, binary_image.shape[0] // 30)

    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontal_size, 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vertical_size))

    horizontal = cv2.erode(binary_image, horizontal_kernel)
    horizontal = cv2.dilate(horizontal, horizontal_kernel)
    vertical = cv2.erode(binary_image, vertical_kernel)
    vertical = cv2.dilate(vertical, vertical_kernel)

    return (
        _extract_segments(horizontal, "horizontal", dpi),
        _extract_segments(vertical, "vertical", dpi),
    )


def _extract_segments(mask, orientation: str, dpi: int) -> list[LineSegment]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    segments: list[LineSegment] = []

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if orientation == "horizontal" and width < 12:
            continue
        if orientation == "vertical" and height < 12:
            continue

        x1 = px_to_pt(x, dpi)
        y1 = px_to_pt(y, dpi)
        x2 = px_to_pt(x + width, dpi) if orientation == "horizontal" else px_to_pt(x + max(1, width), dpi)
        y2 = px_to_pt(y + max(1, height), dpi) if orientation == "vertical" else px_to_pt(y + height, dpi)
        thickness_px = height if orientation == "horizontal" else width

        segments.append(LineSegment(
            orientation=orientation,
            x1=x1,
            y1=y1,
            x2=x2,
            y2=y2,
            thickness=max(0.3, px_to_pt(thickness_px, dpi)),
            color="FF000000",
            confidence=0.94,
        ))

    segments.sort(key=lambda line: (line.y1, line.x1) if orientation == "horizontal" else (line.x1, line.y1))
    return segments
