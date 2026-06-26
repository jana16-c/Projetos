import argparse
import json
import sys
from pathlib import Path

from engine.page_analyzer import analyze_pdf_page
from engine.renderer import render_pdf_page


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze = subparsers.add_parser("analyze-page")
    analyze.add_argument("--pdf", required=True)
    analyze.add_argument("--page", type=int, required=True)
    analyze.add_argument("--dpi", type=int, default=300)
    analyze.add_argument("--languages", default="por+eng")
    analyze.add_argument("--min-confidence", type=float, default=45.0)
    analyze.add_argument("--output", required=True)
    analyze.add_argument("--image-output")

    args = parser.parse_args()

    try:
        if args.command != "analyze-page":
            raise ValueError("Comando invalido.")

        pdf_path = Path(args.pdf)
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        rendered = render_pdf_page(pdf_path, args.page, dpi=args.dpi)
        if args.image_output:
            image_output = Path(args.image_output)
            image_output.parent.mkdir(parents=True, exist_ok=True)
            rendered.image.save(image_output)
        else:
            image_output = None

        result = analyze_pdf_page(
            pdf_path,
            args.page,
            dpi=args.dpi,
            languages=args.languages,
            min_confidence=args.min_confidence,
        )
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

        print(json.dumps({
            "ok": True,
            "page": args.page,
            "output": str(output_path),
            "image": str(image_output) if image_output else "",
        }, ensure_ascii=False))
        return 0
    except Exception as error:  # pragma: no cover - fluxo de CLI
        print(str(error), file=sys.stderr)
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
