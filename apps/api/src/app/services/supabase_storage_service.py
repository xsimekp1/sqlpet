import os
import uuid
from typing import Optional, BinaryIO, Tuple
from urllib.parse import urljoin
from supabase import create_client, Client
from fastapi import HTTPException, UploadFile
from ..core.config import settings


class SupabaseStorageService:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
        )
        self.bucket_name = "animal-photos"
        self.default_images_bucket = "default-animal-images"

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
        ]

        for bucket_name, description in buckets_to_create:
            try:
                # Try to get bucket info
                self.supabase.storage.get_bucket(bucket_name)
                print(f"Bucket {bucket_name} already exists")
            except Exception:
                # Create bucket if it doesn't exist
                try:
                    self.supabase.storage.create_bucket(
                        id=bucket_name,
                        options={
                            "public": False,
                            "file_size_limit": str(settings.max_file_size_bytes),
                            "allowed_mime_types": settings.ALLOWED_FILE_TYPES,
                        },
                    )
                    print(f"Created bucket {bucket_name}")
                except Exception as e:
                    print(f"Failed to create bucket {bucket_name}: {e}")


# Singleton instance
supabase_storage_service = SupabaseStorageService()
