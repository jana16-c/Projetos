from dataclasses import asdict, dataclass, field


@dataclass(slots=True)
class RenderedPage:
    image: object
    page_number: int
    width_px: int
    height_px: int
    width_pt: float
    height_pt: float
    dpi: int


@dataclass(slots=True)
class OcrWord:
    id: str
    pageNumber: int
    index: int
    text: str
    rawText: str
    x: float
    y: float
    width: float
    height: float
    right: float
    bottom: float
    fontName: str = ""
    fontSize: float = 0.0
    dir: str = "ltr"
    hasEOL: bool = False
    sourceType: str = "ocr"
    ocrConfidence: float = 0.0
    blockNumber: int = 0
    paragraphNumber: int = 0
    lineNumber: int = 0
    wordNumber: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class LineSegment:
    orientation: str
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    color: str
    confidence: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class CellStyle:
    fillArgb: str | None = None
    fontColorArgb: str | None = None
    borders: dict = field(default_factory=dict)
    horizontalAlignment: str = "left"
    verticalAlignment: str = "center"
    wrapText: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class VisualCell:
    row: int
    column: int
    x: float
    y: float
    width: float
    height: float
    rowSpan: int = 1
    columnSpan: int = 1
    style: CellStyle = field(default_factory=CellStyle)

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def to_dict(self) -> dict:
        data = asdict(self)
        data["style"] = self.style.to_dict()
        data["right"] = self.right
        data["bottom"] = self.bottom
        return data


@dataclass(slots=True)
class VisualTable:
    bounds: dict
    rows: int
    columns: int
    horizontalLines: list[LineSegment] = field(default_factory=list)
    verticalLines: list[LineSegment] = field(default_factory=list)
    cells: list[VisualCell] = field(default_factory=list)
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "bounds": self.bounds,
            "rows": self.rows,
            "columns": self.columns,
            "horizontalLines": [line.to_dict() for line in self.horizontalLines],
            "verticalLines": [line.to_dict() for line in self.verticalLines],
            "cells": [cell.to_dict() for cell in self.cells],
            "confidence": self.confidence,
            "warnings": list(self.warnings),
        }
