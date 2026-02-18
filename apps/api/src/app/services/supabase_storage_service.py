import os
import uuid
from io import BytesIO
from typing import Optional, BinaryIO, Tuple
from urllib.parse import urljoin
from supabase import create_client, Client
from fastapi import HTTPException, UploadFile
from ..core.config import settings

try:
    from PIL import Image

    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


class SupabaseStorageService:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
        )
        self.bucket_name = "animal-photos"
        self.default_images_bucket = "default-animal-images"
        self.thumbnails_bucket = "animal-thumbnails"
        self.thumbnail_size = (300, 300)

    async def upload_file(
        self,
        file_content: BinaryIO,
        filename: str,
        content_type: str,
        organization_id: str,
        bucket: str = None,
        path_prefix: str = None,
    ) -> Tuple[str, str]:
        """Upload file to Supabase Storage and return (file_url, storage_path)"""

        if bucket is None:
            bucket = self.bucket_name

        # Generate unique filename
        file_ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"

        # Create organization-specific path
        if path_prefix:
            storage_path = f"{path_prefix}/{organization_id}/{unique_filename}"
        else:
            storage_path = f"{organization_id}/{unique_filename}"

        try:
            # Upload to Supabase
            result = self.supabase.storage.from_(bucket).upload(
                path=storage_path,
                file=file_content,
                file_options={"content-type": content_type, "x-upsert": "false"},
            )

            if hasattr(result, "error") and result.error:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload file: {result.error.message}",
                )

            # Generate public URL
            file_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"

            return file_url, storage_path

        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to upload file: {str(e)}"
            )

    async def get_public_url(self, storage_path: str, bucket: str = None) -> str:
        """Generate public URL for file"""
        if bucket is None:
            bucket = self.bucket_name

        try:
            # Try to get thumbnail path - replace organization prefix with thumbnails
            if bucket == self.thumbnails_bucket:
                parts = storage_path.split("/")
                if len(parts) >= 2:
                    storage_path = f"{parts[0]}/thumbnails/{'/'.join(parts[1:])}"

            url = self.supabase.storage.from_(bucket).get_public_url(storage_path)
            return url
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to generate URL: {str(e)}"
            )

    async def delete_file(self, storage_path: str, bucket: str = None) -> bool:
        """Delete file from Supabase Storage"""
        if bucket is None:
            bucket = self.bucket_name

        try:
            result = self.supabase.storage.from_(bucket).remove([storage_path])
            if hasattr(result, "error") and result.error:
                return False
            return True
        except Exception:
            return False

    def ensure_buckets_exist(self):
        """Create buckets if they don't exist - run once manually"""
        buckets_to_create = [
            (self.bucket_name, "User uploaded animal photos"),
            (self.default_images_bucket, "Default animal images for auto-assignment"),
            (self.thumbnails_bucket, "Thumbnails for animal photos and documents"),
        ]

        for bucket_name, description in buckets_to_create:
            try:
                self.supabase.storage.get_bucket(bucket_name)
                print(f"Bucket {bucket_name} already exists")
            except Exception:
                try:
                    self.supabase.storage.create_bucket(
                        id=bucket_name,
                        options={
                            "public": True,
                            "file_size_limit": str(settings.max_file_size_bytes),
                            "allowed_mime_types": settings.ALLOWED_FILE_TYPES,
                        },
                    )
                    print(f"Created bucket {bucket_name}")
                except Exception as e:
                    print(f"Failed to create bucket {bucket_name}: {e}")

    def generate_thumbnail(self, file_content: bytes) -> Optional[bytes]:
        """Generate thumbnail from image file content"""
        if not PIL_AVAILABLE:
            return None

        try:
            img = Image.open(BytesIO(file_content))
            img.thumbnail(self.thumbnail_size, Image.Resampling.LANCZOS)

            output = BytesIO()
            img_format = img.format or "JPEG"
            if img.mode == "RGBA" and img_format == "JPEG":
                img = img.convert("RGB")
            img.save(output, format=img_format, quality=85)
            return output.getvalue()
        except Exception:
            return None

    async def upload_file_with_thumbnail(
        self,
        file_content: BinaryIO | bytes,
        filename: str,
        content_type: str,
        organization_id: str,
        bucket: str = None,
        path_prefix: str = None,
    ) -> Tuple[str, str, Optional[str]]:
        """Upload file to Supabase Storage with auto-generated thumbnail for images"""

        # Ensure we have a BinaryIO for upload
        upload_content: BinaryIO
        if isinstance(file_content, bytes):
            upload_content = BytesIO(file_content)
            thumbnail_bytes = file_content
        else:
            # It's already a BinaryIO, seek to beginning and read for thumbnail
            file_content.seek(0)
            thumbnail_bytes = file_content.read()
            file_content.seek(0)
            upload_content = file_content

        file_url, storage_path = await self.upload_file(
            file_content=upload_content,
            filename=filename,
            content_type=content_type,
            organization_id=organization_id,
            bucket=bucket,
            path_prefix=path_prefix,
        )

        thumbnail_url = None
        if content_type.startswith("image/") and PIL_AVAILABLE and thumbnail_bytes:
            thumbnail_content = self.generate_thumbnail(thumbnail_bytes)
            if thumbnail_content:
                thumbnail_ext = os.path.splitext(filename)[1] or ".jpg"
                thumbnail_filename = f"thumb_{uuid.uuid4()}{thumbnail_ext}"

                if path_prefix:
                    thumb_storage_path = f"{path_prefix}/{organization_id}/thumbnails/{thumbnail_filename}"
                else:
                    thumb_storage_path = (
                        f"{organization_id}/thumbnails/{thumbnail_filename}"
                    )

                try:
                    thumb_result = self.supabase.storage.from_(
                        self.thumbnails_bucket
                    ).upload(
                        path=thumb_storage_path,
                        file=thumbnail_content,
                        file_options={
                            "content-type": content_type,
                            "x-upsert": "false",
                        },
                    )
                    if not hasattr(thumb_result, "error") or not thumb_result.error:
                        thumbnail_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{self.thumbnails_bucket}/{thumb_storage_path}"
                except Exception:
                    pass

        return file_url, storage_path, thumbnail_url


# Singleton instance
supabase_storage_service = SupabaseStorageService()
