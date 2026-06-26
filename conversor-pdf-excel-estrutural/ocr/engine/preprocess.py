import cv2
import numpy as np


def pil_to_bgr(image):
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def prepare_ocr_image(image):
    bgr = pil_to_bgr(image)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    blurred = cv2.GaussianBlur(normalized, (3, 3), 0)
    return cv2.cvtColor(blurred, cv2.COLOR_GRAY2RGB)


def prepare_line_image(image):
    bgr = pil_to_bgr(image)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return cv2.adaptiveThreshold(
        255 - gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        15,
        -2,
    )
