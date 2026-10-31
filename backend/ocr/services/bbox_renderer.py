"""
Bounding Box Renderer using Pillow (PIL).
Draws colored bounding boxes and labels onto document images for visualization and export.
"""

from typing import List, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont
import io


class BBoxRenderer:
    COLOR_MAP = {
        "Names": (249, 115, 22),     # Orange
        "Dates": (59, 130, 246),     # Blue
        "IDs": (168, 85, 247),       # Purple
        "Amounts": (34, 197, 94),     # Green
        "Table": (20, 184, 166),     # Teal
    }

    @classmethod
    def render_annotated_image(
        cls,
        image_bytes: bytes,
        fields: List[Dict[str, Any]],
        table_bbox: Optional[List[float]] = None,
        selected_field_name: Optional[str] = None,
    ) -> bytes:
        """
        Draws colored boxes and text labels onto the image.
        Returns annotated image as JPEG bytes.
        """
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        draw = ImageDraw.Draw(img)
        w, h = img.size

        # 1. Draw Table Boundary (if present)
        if table_bbox and len(table_bbox) == 4:
            ymin, xmin, ymax, xmax = table_bbox
            x1 = int((xmin / 100) * w)
            y1 = int((ymin / 100) * h)
            x2 = int((xmax / 100) * w)
            y2 = int((ymax / 100) * h)
            # Dotted/thin teal rectangle
            teal = cls.COLOR_MAP["Table"]
            draw.rectangle([x1, y1, x2, y2], outline=teal, width=2)
            # Table badge
            draw.rectangle([x1, max(0, y1 - 18), x1 + 105, y1], fill=teal)
            draw.text((x1 + 4, max(0, y1 - 16)), "Table 1 detected", fill=(255, 255, 255))

        # 2. Draw Field Bounding Boxes
        for f in fields:
            bbox = f.get("bbox_norm")
            if not bbox or len(bbox) != 4:
                continue

            ymin, xmin, ymax, xmax = bbox
            x1 = int((xmin / 100) * w)
            y1 = int((ymin / 100) * h)
            x2 = int((xmax / 100) * w)
            y2 = int((ymax / 100) * h)

            category = f.get("category", "Names")
            color = cls.COLOR_MAP.get(category, (249, 115, 22))
            is_selected = (f.get("name") == selected_field_name)

            box_width = 3 if is_selected else 2
            draw.rectangle([x1, y1, x2, y2], outline=color, width=box_width)

            # If selected or amount, show label
            if is_selected:
                label_txt = f"{f.get('label', f.get('name'))} - selected"
                draw.rectangle([x1, y2, x1 + 110, y2 + 18], fill=color)
                draw.text((x1 + 4, y2 + 2), label_txt, fill=(255, 255, 255))

        out_buffer = io.BytesIO()
        img.save(out_buffer, format="JPEG", quality=92)
        return out_buffer.getvalue()

