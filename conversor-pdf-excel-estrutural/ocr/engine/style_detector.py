import numpy as np


def detect_cell_style(image_array, cell, scale: float = 1.0) -> dict:
    height, width = image_array.shape[:2]
    left = max(0, min(width - 1, int(round(cell.x * scale))))
    top = max(0, min(height - 1, int(round(cell.y * scale))))
    right = max(left + 1, min(width, int(round(cell.right * scale))))
    bottom = max(top + 1, min(height, int(round(cell.bottom * scale))))

    interior = image_array[top:bottom, left:right]
    fill_argb = rgb_to_argb(_mean_color(interior))

    return {
        "fillArgb": fill_argb,
        "fontColorArgb": "FF000000",
        "borders": {
            "top": {"color": rgb_to_argb(_mean_color(image_array[top:top + 1, left:right])), "style": "thin"},
            "right": {"color": rgb_to_argb(_mean_color(image_array[top:bottom, right - 1:right])), "style": "thin"},
            "bottom": {"color": rgb_to_argb(_mean_color(image_array[bottom - 1:bottom, left:right])), "style": "thin"},
            "left": {"color": rgb_to_argb(_mean_color(image_array[top:bottom, left:left + 1])), "style": "thin"},
        },
        "horizontalAlignment": "left",
        "verticalAlignment": "center",
        "wrapText": True,
    }


def _mean_color(region) -> tuple[int, int, int]:
    if region.size == 0:
        return (255, 255, 255)
    mean = np.mean(region.reshape(-1, 3), axis=0)
    return tuple(int(round(channel)) for channel in mean.tolist())


def rgb_to_argb(color: tuple[int, int, int]) -> str:
    red, green, blue = color
    return f"FF{red:02X}{green:02X}{blue:02X}"
