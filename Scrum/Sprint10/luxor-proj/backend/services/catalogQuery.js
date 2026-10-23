// SFTWRKEY-424: arma la consulta paginada y filtrada del catálogo público.
// Todo el SQL usa parámetros ($1, $2...) para evitar inyección; el orden sale
// de una lista cerrada, nunca del texto que manda el cliente.

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

const SORTS = {
  newest: 'p.created_at DESC, p.id ASC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id ASC',
  name: 'p.name ASC, p.id ASC',
};

const toPositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const toPrice = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const toText = (value) => (typeof value === 'string' ? value.trim().slice(0, 100) : '');

export function parseCatalogParams(query = {}) {
  const sort = Object.hasOwn(SORTS, query.sort) ? query.sort : 'newest';
  const categoryId = Number.parseInt(query.category, 10);

  return {
    q: toText(query.q),
    brand: toText(query.brand),
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    minPrice: toPrice(query.minPrice),
    maxPrice: toPrice(query.maxPrice),
    sort,
    page: toPositiveInt(query.page, 1),
    pageSize: Math.min(toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
  };
}

export function buildCatalogQuery(params) {
  // Solo se muestran perfumes con stock disponible.
  const where = ['p.stock > 0'];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (params.q) {
    const like = add(`%${params.q}%`);
    where.push(`(p.name ILIKE ${like} OR p.brand ILIKE ${like} OR p.description ILIKE ${like})`);
  }
  if (params.brand) where.push(`LOWER(p.brand) = LOWER(${add(params.brand)})`);
  if (params.categoryId) where.push(`p.category_id = ${add(params.categoryId)}`);
  if (params.minPrice !== null) where.push(`p.price >= ${add(params.minPrice)}`);
  if (params.maxPrice !== null) where.push(`p.price <= ${add(params.maxPrice)}`);

  const whereSql = where.join(' AND ');
  const limit = add(params.pageSize);
  const offset = add((params.page - 1) * params.pageSize);

  return {
    countSql: `SELECT COUNT(*)::int AS total FROM products p WHERE ${whereSql}`,
    countValues: values.slice(0, values.length - 2),
    listSql: `SELECT p.*, c.nombre AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${whereSql}
       ORDER BY ${SORTS[params.sort]}
       LIMIT ${limit} OFFSET ${offset}`,
    listValues: values,
  };
}
