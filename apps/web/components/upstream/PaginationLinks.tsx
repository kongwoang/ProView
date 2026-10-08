'use client';

// Numbered-window/count logic adapted from OpenReview PaginationLinks.js. AGPL-3.0-or-later.
export default function PaginationLinks({
  currentPage,
  itemsPerPage,
  totalCount,
  setCurrentPage,
}: {
  currentPage: number;
  itemsPerPage: number;
  totalCount: number;
  setCurrentPage: (page: number) => void;
}) {
  const pageCount = Math.ceil(totalCount / itemsPerPage);
  if (pageCount <= 1) return null;
  const pageListLength = Math.min(7, pageCount);
  const firstPage = Math.min(
    Math.max(currentPage - Math.floor(pageListLength / 2), 1),
    Math.max(pageCount - pageListLength + 1, 1),
  );
  return (
    <nav className="pagination" aria-label="Page navigation">
      <span className="muted">
        Showing {(currentPage - 1) * itemsPerPage + 1}–
        {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
      </span>
      <div className="button-row">
        <button
          className="button secondary"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Previous
        </button>
        {Array.from({ length: pageListLength }, (_, i) => firstPage + i).map((page) => (
          <button
            key={page}
            className={`button ${page === currentPage ? '' : 'secondary'}`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}
        <button
          className="button secondary"
          disabled={currentPage === pageCount}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
