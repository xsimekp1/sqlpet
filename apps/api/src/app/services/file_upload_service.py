from typing import BinaryIO, Tuple
from fastapi import HTTPException, UploadFile
from ..core.config import settings


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
    async def get_real_file_type(file: BinaryIO, fallback_content_type: str) -> str:
        """Get file type - use content-type from header (simpler, works reliably)"""
        # Use content-type from header as it's reliable for browser uploads
        return fallback_content_type or "application/octet-stream"

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

        # Use content-type from header (reliable for browser uploads)
        content_type = file.content_type or "application/octet-stream"

        return file_content, content_type


file_upload_service = FileUploadService()
