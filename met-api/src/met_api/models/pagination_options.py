"""This module holds data classes."""

from attr import dataclass


DEFAULT_PAGE = 1
DEFAULT_SIZE = 25
MAX_SIZE = 100


@dataclass
class PaginationOptions:  # pylint: disable=too-many-instance-attributes
    """Used to store pagination options."""

    page: int
    size: int
    sort_key: int
    sort_order: str

    def bounded(self) -> 'PaginationOptions':
        """Return these options with a page and size a list query can rely on.

        A missing page or size used to mean "every matching row". Out-of-range values are
        clamped rather than rejected, so an existing caller gets a first page, not an error.
        """
        page = self.page if self.page and self.page > 0 else DEFAULT_PAGE
        size = self.size if self.size and self.size > 0 else DEFAULT_SIZE
        return PaginationOptions(
            page=page,
            size=min(size, MAX_SIZE),
            sort_key=self.sort_key,
            sort_order=self.sort_order,
        )


def paginate(query, pagination_options: PaginationOptions):
    """Return one page of a query, along with the total number of matches.

    flask_sqlalchemy's `db.paginate` re-executes the query through `session.execute`,
    which drops the column projections the list queries rely on, so the page is taken with
    Query methods instead. Every list query these options page joins only many-to-one, so
    a row cannot appear twice.
    """
    offset = (pagination_options.page - 1) * pagination_options.size
    total = query.order_by(None).count()
    items = query.limit(pagination_options.size).offset(offset).all()
    return items, total
