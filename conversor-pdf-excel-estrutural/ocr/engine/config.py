from dataclasses import dataclass


@dataclass(slots=True)
class OcrConfig:
    dpi: int = 300
    languages: str = "por+eng"
    min_confidence: float = 45.0
    oem: int = 1
    psm: int = 11
    preserve_interword_spaces: bool = True

    def build_tesseract_config(self, psm: int | None = None) -> str:
        spacing = 1 if self.preserve_interword_spaces else 0
        effective_psm = self.psm if psm is None else psm
        return f"--oem {self.oem} --psm {effective_psm} -c preserve_interword_spaces={spacing}"
