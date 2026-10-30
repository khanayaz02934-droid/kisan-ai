// Responsive table: real <table> on md+, stacked cards on mobile via data-label.
export default function Table({ columns = [], rows = [], renderMobile }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-muted">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row._id || row.id || i} className="border-t border-line">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-ink">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <div key={row._id || row.id || i} className="card p-4">
            {renderMobile
              ? renderMobile(row)
              : columns.map((c) => (
                  <div key={c.key} className="flex justify-between gap-3 py-1 text-sm">
                    <span className="text-muted">{c.label}</span>
                    <span className="text-right font-medium text-ink">
                      {c.render ? c.render(row) : row[c.key]}
                    </span>
                  </div>
                ))}
          </div>
        ))}
      </div>
    </>
  );
}
