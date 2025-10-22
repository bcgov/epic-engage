"""ImageInfo model class.

Manages the ImageInfo
"""

from sqlalchemy import asc, desc
from sqlalchemy.sql import text

from met_api.models import db
from met_api.models.base_model import BaseModel
from met_api.models.pagination_options import PaginationOptions


class ImageInfo(BaseModel):
    """Definition of the ImageInfo entity."""

    __tablename__ = 'image_info'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    unique_name = db.Column(db.String())
    display_name = db.Column(db.String())
    date_uploaded = db.Column(db.DateTime)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    created_date = db.Column(db.DateTime)
    updated_date = db.Column(db.DateTime)
    archived = db.Column(db.Boolean, default=False)

    @classmethod
    def get_images_paginated(cls, pagination_options: PaginationOptions, search_options=None, archived=False):
        """Get images paginated."""
        query = db.session.query(ImageInfo)

        query = cls._add_tenant_filter(query)

        if archived is not None:
            query = query.filter(ImageInfo.archived == archived)

        if search_options:
            query = cls._filter_by_search_text(query, search_options)

        sort = cls._get_sort_order(pagination_options)
        query = query.order_by(sort)

        page = query.paginate(page=pagination_options.page, per_page=pagination_options.size)
        return page.items, page.total

    @staticmethod
    def _filter_by_search_text(query, search_options):
        if search_text := search_options.get('search_text'):
            query = query.filter(ImageInfo.display_name.ilike('%' + search_text + '%'))
        return query

    @staticmethod
    def _get_sort_order(pagination_options):
        sort = asc(text(pagination_options.sort_key)) if pagination_options.sort_order == 'asc' \
            else desc(text(pagination_options.sort_key))
        return sort

    @classmethod
    def update(cls, image_info_id, image_info_data):
        """Update image by ID."""
        query = db.session.query(ImageInfo)
        query = cls._add_tenant_filter(query)
        image = query.filter(ImageInfo.id == image_info_id).one_or_none()

        if not image:
            return None  # Image not found

        for key, value in image_info_data.items():
            if hasattr(image, key):
                setattr(image, key, value)

        db.session.commit()
        return image

    @classmethod
    def delete_by_id(cls, image_info_id):
        """Delete image by ID."""
        query = db.session.query(ImageInfo)
        query = cls._add_tenant_filter(query)
        image = query.filter(ImageInfo.id == image_info_id).one_or_none()

        if not image:
            return False  # Image not found

        db.session.delete(image)
        db.session.commit()
        return True
