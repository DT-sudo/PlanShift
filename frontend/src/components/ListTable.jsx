import { t } from '../i18n/index.js';

export function ListTable({ label, columns, empty, children }) {
  const headers = [...columns, t('team.actions')];

  return (
    <div className="card mt-3">
      <table className="table" aria-label={label}>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={header} className={index === headers.length - 1 ? 'cell-actions' : undefined}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children.length ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length} className="p-8 text-center text-sm text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
