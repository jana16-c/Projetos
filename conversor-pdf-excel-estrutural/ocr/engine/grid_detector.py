from .schema import CellStyle, VisualCell, VisualTable


def build_visual_tables(horizontal_lines, vertical_lines) -> list[VisualTable]:
    if len(horizontal_lines) < 2 or len(vertical_lines) < 2:
        return []

    x_boundaries = _cluster_boundaries([line.x1 for line in vertical_lines] + [line.x2 for line in vertical_lines])
    y_boundaries = _cluster_boundaries([line.y1 for line in horizontal_lines] + [line.y2 for line in horizontal_lines])

    if len(x_boundaries) < 2 or len(y_boundaries) < 2:
        return []

    cells: list[VisualCell] = []
    for row_index in range(len(y_boundaries) - 1):
        for column_index in range(len(x_boundaries) - 1):
            cells.append(VisualCell(
                row=row_index,
                column=column_index,
                x=x_boundaries[column_index],
                y=y_boundaries[row_index],
                width=max(0.5, x_boundaries[column_index + 1] - x_boundaries[column_index]),
                height=max(0.5, y_boundaries[row_index + 1] - y_boundaries[row_index]),
                style=CellStyle(),
            ))

    table = VisualTable(
        bounds={
            "left": x_boundaries[0],
            "right": x_boundaries[-1],
            "top": y_boundaries[0],
            "bottom": y_boundaries[-1],
        },
        rows=len(y_boundaries) - 1,
        columns=len(x_boundaries) - 1,
        horizontalLines=list(horizontal_lines),
        verticalLines=list(vertical_lines),
        cells=cells,
        confidence=0.93,
        warnings=[],
    )
    return [table]


def _cluster_boundaries(values, tolerance: float = 1.2) -> list[float]:
    if not values:
        return []

    sorted_values = sorted(float(value) for value in values)
    clusters: list[list[float]] = [[sorted_values[0]]]

    for value in sorted_values[1:]:
        if abs(value - clusters[-1][-1]) <= tolerance:
            clusters[-1].append(value)
        else:
            clusters.append([value])

    return [sum(cluster) / len(cluster) for cluster in clusters]
