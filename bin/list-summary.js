export function summarizeList(items, options = {}) {
  const sortKey = options.sortKey || 'updatedAt';
  const topN = options.topN || 3;
  const groupKey = options.groupKey;
  const byStatus = {};
  const byGroup = {};
  for (const item of items) {
    const s = item?.status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
    if (groupKey) {
      const v = item?.[groupKey];
      const sv = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
      if (sv) byGroup[sv] = (byGroup[sv] || 0) + 1;
    }
  }
  const sortCandidates = items
    .map((item) => ({ item, sortValue: item?.[sortKey] }))
    .filter((entry) => typeof entry.sortValue === 'string' && entry.sortValue !== '')
    .sort((left, right) => left.sortValue.localeCompare(right.sortValue));
  const top = sortCandidates.slice(0, topN).map(({ item, sortValue }) => ({
    id: item?.id,
    name: item?.name,
    status: item?.status,
    sortKey: sortValue,
  }));
  const highlight = items.length === 0 ? '当前无数据。' : `共 ${items.length} 条${groupKey ? `（按 ${groupKey} 分布）` : ''}。`;
  const summary = { total: items.length, byStatus, top, highlight };
  if (groupKey && Object.keys(byGroup).length > 0) {
    summary.byGroup = byGroup;
    summary.groupKey = groupKey;
  }
  return summary;
}

export function promoteAgentFirstFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const meta = value.meta;
  if (meta && meta.processed === true) {
    return { ...(value.summary ? { summary: value.summary } : {}), ...value };
  }
  return value;
}
