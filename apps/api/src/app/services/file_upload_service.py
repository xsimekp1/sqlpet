from typing import BinaryIO, Tuple
from fastapi import HTTPException, UploadFile
from ..core.config import settings

try:
    import magic
except ImportError:
    magic = None


class FileUploadService:
    @staticmethod
    def validate_file(file: UploadFile) -> None:
        """Validate file type and size"""

        # Check file size
        if (
            hasattr(file, "size")
            and settings.max_file_size_bytes
            and file.size > settings.max_file_size_bytes
        ):
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB",
            )

        # Check content type
        if file.content_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400, detail=f"File type {file.content_type} not allowed"
            )

    @staticmethod
    async def get_real_file_type(file: BinaryIO) -> str:
        """Get real file type using python-magic"""
        import aiofiles

        file.seek(0)
        file_content = file.read(1024)  # Read first 1KB for type detection
        file.seek(0)  # Reset file position

        try:
            if magic:
                mime_type = magic.from_buffer(file_content, mime=True)
                return mime_type
        except Exception:
            # Fallback to content-type header
            return getattr(file, "content_type", "application/octet-stream")

    @staticmethod
    async def process_upload(
        file: UploadFile, organization_id: str, is_public: bool = False
    ) -> Tuple[bytes, str]:
        """
        Process file upload and return (file_content, content_type)
        """

        # Validate file
        FileUploadService.validate_file(file)

        # Read file content
        file_content = await file.read()

        # Get real file type for security
        from io import BytesIO

        file_stream = BytesIO(file_content)
        real_mime_type = await FileUploadService.get_real_file_type(file_stream)

        # Double-check MIME type
        if real_mime_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400, detail=f"Actual file type {real_mime_type} not allowed"
            )

        return file_content, real_mime_type


file_upload_service = FileUploadService()
