export function getPaginatedItems(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

export function getPaginatedCount(data) {
  if (typeof data?.count === "number") {
    return data.count;
  }

  if (Array.isArray(data)) {
    return data.length;
  }

  return 0;
}
