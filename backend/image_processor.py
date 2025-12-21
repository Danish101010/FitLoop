"""
FitLoop Image Processor
Version: 1.0.0 (MVP)

Handles image preprocessing before sending to Gemini.
Abstracted to allow easy migration from base64 to S3 URLs in future.
"""
import base64
from io import BytesIO
from typing import Protocol, TypedDict
from PIL import Image, ImageOps
import hashlib

from config import IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY, IMAGE_MAX_SIZE_BYTES


class ImageData(TypedDict):
    """Standardized image data for Gemini API."""
    type: str  # "base64" or "url"
    data: str | None  # base64 string if type is "base64"
    url: str | None   # signed URL if type is "url"
    mime_type: str
    hash: str  # For deduplication and correction matching


class ImageProcessor(Protocol):
    """Protocol for image processing implementations."""
    
    async def prepare_for_gemini(self, image_bytes: bytes) -> ImageData:
        """Process image and return data ready for Gemini API."""
        ...


class Base64Processor:
    """
    MVP Implementation: Direct base64 encoding with smart compression.
    
    Decision 1: Option A (direct base64) with future B-migration path
    Decision 7: Option D (smart compression)
    """
    
    def __init__(
        self,
        max_dimension: int = IMAGE_MAX_DIMENSION,
        jpeg_quality: int = IMAGE_JPEG_QUALITY,
    ):
        self.max_dimension = max_dimension
        self.jpeg_quality = jpeg_quality
    
    async def prepare_for_gemini(self, image_bytes: bytes) -> ImageData:
        """
        Process image with smart compression and return base64 encoded data.
        
        Steps:
        1. Validate image size
        2. Fix EXIF orientation
        3. Resize if larger than max dimension
        4. Compress as JPEG
        5. Generate hash for deduplication
        6. Return base64 encoded result
        """
        # Validate input size
        if len(image_bytes) > IMAGE_MAX_SIZE_BYTES:
            raise ValueError(f"Image too large: {len(image_bytes)} bytes (max {IMAGE_MAX_SIZE_BYTES})")
        
        # Open and process image
        img = Image.open(BytesIO(image_bytes))
        
        # Fix EXIF orientation (common issue with phone photos)
        img = ImageOps.exif_transpose(img)
        
        # Convert to RGB if necessary (handles PNG with transparency, etc.)
        if img.mode in ("RGBA", "P", "LA"):
            # Create white background for transparent images
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
        
        # Resize if larger than max dimension (maintain aspect ratio)
        if max(img.size) > self.max_dimension:
            img.thumbnail((self.max_dimension, self.max_dimension), Image.LANCZOS)
        
        # Compress as JPEG
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=self.jpeg_quality, optimize=True)
        compressed_bytes = buffer.getvalue()
        
        # Generate hash for deduplication
        image_hash = hashlib.sha256(compressed_bytes).hexdigest()[:16]
        
        # Encode to base64
        base64_data = base64.b64encode(compressed_bytes).decode("utf-8")
        
        return ImageData(
            type="base64",
            data=base64_data,
            url=None,
            mime_type="image/jpeg",
            hash=image_hash,
        )


class S3Processor:
    """
    Future Implementation: Upload to S3 and return signed URL.
    
    This is a placeholder for v1.1 migration.
    See FUTURE_PLANS.md - Enhancement #1
    """
    
    def __init__(self, bucket_name: str, region: str):
        self.bucket_name = bucket_name
        self.region = region
        # TODO: Initialize S3 client
        raise NotImplementedError("S3Processor is planned for v1.1. See FUTURE_PLANS.md")
    
    async def prepare_for_gemini(self, image_bytes: bytes) -> ImageData:
        """Upload to S3 and return signed URL."""
        # TODO: Implement in v1.1
        # 1. Smart compress image (same as Base64Processor)
        # 2. Generate unique key with timestamp
        # 3. Upload to S3
        # 4. Generate signed URL (1 hour expiry)
        # 5. Return URL-based ImageData
        raise NotImplementedError("S3Processor is planned for v1.1")


# Factory function to get the appropriate processor
def get_image_processor() -> ImageProcessor:
    """
    Returns the configured image processor.
    
    MVP: Returns Base64Processor
    Future: Can be configured via environment variable to return S3Processor
    """
    # For MVP, always use base64
    return Base64Processor()


def decode_base64_image(base64_string: str) -> bytes:
    """Utility to decode base64 image data."""
    # Handle data URL format if present
    if base64_string.startswith("data:"):
        # Extract base64 part from data URL
        base64_string = base64_string.split(",", 1)[1]
    
    return base64.b64decode(base64_string)

