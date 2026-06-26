from PIL import Image, ImageDraw

from ocr.engine.page_analyzer import analyze_page_image


def test_page_analyzer_detects_lines_and_table():
    image = Image.new("RGB", (320, 240), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 300, 70), fill=(220, 235, 255))

    for y in (20, 70, 120, 170):
        draw.line((20, y, 300, y), fill="black", width=3)

    for x in (20, 120, 220, 300):
        draw.line((x, 20, x, 170), fill="black", width=3)

    result = analyze_page_image(image, page_number=1, dpi=300)

    assert result["pageNumber"] == 1
    assert len(result["horizontalLines"]) >= 4
    assert len(result["verticalLines"]) >= 4
    assert len(result["visualTables"]) == 1
    assert result["visualTables"][0]["rows"] == 3
    assert result["visualTables"][0]["columns"] == 3
