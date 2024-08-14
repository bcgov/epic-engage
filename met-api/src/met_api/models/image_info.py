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

    @classmethod
    def get_images_paginated(cls, pagination_options: PaginationOptions, search_options=None):
        """Get images paginated."""
        query = db.session.query(ImageInfo)

        query = cls._add_tenant_filter(query)

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
