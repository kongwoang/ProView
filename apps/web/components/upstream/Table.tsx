// Adapted from OpenReview components/Table.js. AGPL-3.0-or-later.
import type { ReactNode } from 'react';

export default function Table({
  headings,
  children,
  caption,
}: {
  headings: { id: string; content: ReactNode; width?: string }[];
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="table-scroll">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th
                key={heading.id}
                scope="col"
                style={heading.width ? { width: heading.width } : undefined}
              >
                {heading.content}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
