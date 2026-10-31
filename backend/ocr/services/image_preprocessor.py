"""
Image Preprocessing Service for Document OCR Pipeline.
Implements Deskewing, Denoising, CLAHE (Contrast Enhancement), Binarization, and Border Removal.
Uses OpenCV (opencv-python-headless).
"""

import cv2
import numpy as np
from PIL import Image
import io
import math
from typing import Tuple, Dict, Any


class ImagePreprocessor:
    @staticmethod
    def load_image(image_input) -> np.ndarray:
        """Loads an image from filepath, bytes, or numpy array into BGR format."""
        if isinstance(image_input, np.ndarray):
            return image_input
        if isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image from bytes.")
            return img
        if isinstance(image_input, str):
            img = cv2.imread(image_input)
            if img is None:
                raise ValueError(f"Could not load image from path: {image_input}")
            return img
        raise TypeError(f"Unsupported image input type: {type(image_input)}")

    @staticmethod
    def detect_skew_angle(gray: np.ndarray) -> float:
        """
        Calculates the skew angle (in degrees) of a document image using Hough transform and contours.
        Returns angle between -45 and 45 degrees.
        """
        # Invert colors so text is white
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 9
        )

        # Detect lines using HoughLinesP
        lines = cv2.HoughLinesP(thresh, 1, np.pi / 180, 100, minLineLength=80, maxLineGap=10)
        angles = []
        if lines is not None:
            for line in lines:
                coords = line[0] if len(line.shape) > 1 and len(line) == 1 else line
                if len(coords) >= 4:
                    x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
                    angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
                    # Only consider near-horizontal lines (-35 to +35 degrees)
                    if abs(angle) <= 35:
                        angles.append(angle)

        if angles:
            median_angle = float(np.median(angles))
            return median_angle

        # Fallback: minAreaRect on contours
        pts = cv2.findNonZero(thresh)
        if pts is not None and len(pts) > 50:
            rect = cv2.minAreaRect(pts)
            angle = rect[-1]
            if angle < -45:
                angle = 90 + angle
            elif angle > 45:
                angle = angle - 90
            if abs(angle) <= 35:
                return float(angle)

        return 0.0

    @staticmethod
    def rotate_image(image: np.ndarray, angle: float) -> np.ndarray:
        """Rotates image by specified angle with white background padding."""
        if abs(angle) < 0.2:
            return image  # Negligible rotation

        h, w = image.shape[:2]
        center = (w // 2, h // 2)

        # Compute rotation matrix
        M = cv2.getRotationMatrix2D(center, angle, 1.0)

        # Determine new bounding dimension so edges aren't cut off
        cos = np.abs(M[0, 0])
        sin = np.abs(M[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))

        M[0, 2] += (new_w / 2) - center[0]
        M[1, 2] += (new_h / 2) - center[1]

        # Use white border for clean document margins
        rotated = cv2.warpAffine(
            image, M, (new_w, new_h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255)
        )
        return rotated

    @staticmethod
    def enhance_contrast_clahe(image: np.ndarray) -> np.ndarray:
        """Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) to L-channel."""
        if len(image.shape) == 2:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            return clahe.apply(image)

        # Convert BGR to LAB
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

    @staticmethod
    def denoise(image: np.ndarray) -> np.ndarray:
        """Applies bilateral filtering to smooth background noise while preserving sharp text edges."""
        if len(image.shape) == 2:
            return cv2.bilateralFilter(image, d=7, sigmaColor=50, sigmaSpace=50)
        return cv2.bilateralFilter(image, d=7, sigmaColor=50, sigmaSpace=50)

    @staticmethod
    def binarize(gray: np.ndarray) -> np.ndarray:
        """Applies Otsu's thresholding for high-contrast black-and-white text."""
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return thresh

    @staticmethod
    def crop_borders(image: np.ndarray) -> np.ndarray:
        """Detects and crops black scanner borders or empty margin framing."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        _, thresh = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image

        # Find largest bounding area
        h, w = image.shape[:2]
        c = max(contours, key=cv2.contourArea)
        x, y, cw, ch = cv2.boundingRect(c)
        # Only crop if it removes significant black border, not text
        if cw > w * 0.6 and ch > h * 0.6:
            return image[y:y+ch, x:x+cw]
        return image

    @classmethod
    def preprocess(
        cls,
        image_input,
        do_deskew: bool = True,
        do_denoise: bool = True,
        do_clahe: bool = True,
        do_crop: bool = True,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Executes full preprocessing pipeline.
        Returns:
            processed_image: np.ndarray (BGR format ready for OCR & viewing)
            metadata: dict with timing, angle, and applied steps
        """
        img = cls.load_image(image_input)
        h, w = img.shape[:2]
        metadata = {
            "original_width": w,
            "original_height": h,
            "skew_angle": 0.0,
            "deskewed": False,
            "denoised": False,
            "clahe_applied": False,
            "cropped": False,
            "resolution_warning": None,
        }

        # Resolution check: warn if width or height < 600px
        if min(w, h) < 600:
            metadata["resolution_warning"] = "Low resolution document (recommended >= 150 DPI / 1000px)."
            # Upscale image slightly for better OCR
            scale = 1000 / min(w, h)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        current = img

        # 1. Border removal
        if do_crop:
            cropped = cls.crop_borders(current)
            if cropped.shape != current.shape:
                current = cropped
                metadata["cropped"] = True

        # 2. Deskew
        if do_deskew:
            gray = cv2.cvtColor(current, cv2.COLOR_BGR2GRAY) if len(current.shape) == 3 else current
            angle = cls.detect_skew_angle(gray)
            metadata["skew_angle"] = round(angle, 2)
            if abs(angle) >= 0.5:
                current = cls.rotate_image(current, angle)
                metadata["deskewed"] = True

        # 3. Denoise
        if do_denoise:
            current = cls.denoise(current)
            metadata["denoised"] = True

        # 4. CLAHE contrast boost
        if do_clahe:
            current = cls.enhance_contrast_clahe(current)
            metadata["clahe_applied"] = True

        metadata["final_width"] = current.shape[1]
        metadata["final_height"] = current.shape[0]

        return current, metadata

    @staticmethod
    def to_jpeg_bytes(image: np.ndarray, quality: int = 95) -> bytes:
        """Encodes numpy image to JPEG bytes."""
        success, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            raise ValueError("Failed to encode image to JPEG.")
        return encoded.tobytes()
