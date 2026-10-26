import { Category } from '../types';

/**
 * 规范化并对齐分类结构：
 * 1. 严格按 ID 去重（彻底杜绝移动或编辑导致的分类复制/多出副本 Bug）
 * 2. 补齐并规整各层级的 1-based 排序序号 (order: 1, 2, 3...)
 * 3. 严格组织树形平铺结构：父分类后紧跟其所属子分类，杜绝断层与乱序
 */
export function normalizeCategories(cats: Category[]): Category[] {
  if (!Array.isArray(cats)) return [];

  // 1. 去重并过滤无效项
  const seenIds = new Set<string>();
  const uniqueCats: Category[] = [];
  for (const c of cats) {
    if (c && c.id && !seenIds.has(c.id)) {
      seenIds.add(c.id);
      uniqueCats.push({ ...c });
    }
  }

  // 2. 分离一级主分类与二级子分类
  const rootCats = uniqueCats.filter(c => !c.parentId);
  const subCats = uniqueCats.filter(c => !!c.parentId);

  // 按 parentId 分组子分类
  const subCatsByParent = new Map<string, Category[]>();
  for (const sub of subCats) {
    if (!subCatsByParent.has(sub.parentId!)) {
      subCatsByParent.set(sub.parentId!, []);
    }
    subCatsByParent.get(sub.parentId!)!.push(sub);
  }

  // 一级主分类按 order 排序（无 order 则保留原数组相对次序）
  rootCats.sort((a, b) => {
    const orderA = typeof a.order === 'number' && !isNaN(a.order) ? a.order : 9999;
    const orderB = typeof b.order === 'number' && !isNaN(b.order) ? b.order : 9999;
    return orderA - orderB;
  });
  rootCats.forEach((c, idx) => {
    c.order = idx + 1;
  });

  // 各组二级子分类在其父分类内按 order 排序
  for (const [, subs] of subCatsByParent.entries()) {
    subs.sort((a, b) => {
      const orderA = typeof a.order === 'number' && !isNaN(a.order) ? a.order : 9999;
      const orderB = typeof b.order === 'number' && !isNaN(b.order) ? b.order : 9999;
      return orderA - orderB;
    });
    subs.forEach((sc, idx) => {
      sc.order = idx + 1;
    });
  }

  // 组装平铺数组：一级分类 + 其子分类
  const result: Category[] = [];
  const handledSubIds = new Set<string>();
  for (const root of rootCats) {
    result.push(root);
    const children = subCatsByParent.get(root.id) || [];
    for (const child of children) {
      result.push(child);
      handledSubIds.add(child.id);
    }
  }

  // 兜底处理可能存在的孤儿分类（parentId 指向不存在的分类）
  for (const sub of subCats) {
    if (!handledSubIds.has(sub.id)) {
      result.push(sub);
    }
  }

  return result;
}

/**
 * 检查分类是否可以上移/下移
 */
export function canMoveCategory(cats: Category[], catId: string, direction: 'up' | 'down'): boolean {
  const normalized = normalizeCategories(cats);
  const cat = normalized.find(c => c.id === catId);
  if (!cat) return false;

  if (!cat.parentId) {
    const roots = normalized.filter(c => !c.parentId);
    const currIdx = roots.findIndex(c => c.id === catId);
    if (currIdx === -1) return false;
    return direction === 'up' ? currIdx > 0 : currIdx < roots.length - 1;
  } else {
    const siblings = normalized.filter(c => c.parentId === cat.parentId);
    const currIdx = siblings.findIndex(c => c.id === catId);
    if (currIdx === -1) return false;
    return direction === 'up' ? currIdx > 0 : currIdx < siblings.length - 1;
  }
}

/**
 * 上移或下移分类（通过调换同层级相邻项的顺序）
 */
export function moveCategory(cats: Category[], catId: string, direction: 'up' | 'down'): Category[] {
  const normalized = normalizeCategories(cats);
  const cat = normalized.find(c => c.id === catId);
  if (!cat) return normalized;

  if (!cat.parentId) {
    const roots = normalized.filter(c => !c.parentId);
    const currIdx = roots.findIndex(c => c.id === catId);
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= roots.length) return normalized;

    const temp = roots[currIdx];
    roots[currIdx] = roots[targetIdx];
    roots[targetIdx] = temp;

    roots.forEach((r, idx) => { r.order = idx + 1; });

    const subCats = normalized.filter(c => !!c.parentId);
    return normalizeCategories([...roots, ...subCats]);
  } else {
    const siblings = normalized.filter(c => c.parentId === cat.parentId);
    const currIdx = siblings.findIndex(c => c.id === catId);
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return normalized;

    const temp = siblings[currIdx];
    siblings[currIdx] = siblings[targetIdx];
    siblings[targetIdx] = temp;

    siblings.forEach((s, idx) => { s.order = idx + 1; });

    const otherCats = normalized.filter(c => c.parentId !== cat.parentId);
    return normalizeCategories([...otherCats, ...siblings]);
  }
}

/**
 * 直接设置分类序号（数字越小越靠前，1-based）
 */
export function setCategoryOrder(cats: Category[], catId: string, newOrder: number | string): Category[] {
  const normalized = normalizeCategories(cats);
  const cat = normalized.find(c => c.id === catId);
  if (!cat) return normalized;

  const targetOrder = Math.max(1, parseInt(String(newOrder), 10) || 1);

  if (!cat.parentId) {
    const roots = normalized.filter(c => !c.parentId);
    const currIdx = roots.findIndex(c => c.id === catId);
    if (currIdx === -1) return normalized;

    const [item] = roots.splice(currIdx, 1);
    const insertIdx = Math.min(Math.max(0, targetOrder - 1), roots.length);
    roots.splice(insertIdx, 0, item);
    roots.forEach((r, idx) => { r.order = idx + 1; });

    const subCats = normalized.filter(c => !!c.parentId);
    return normalizeCategories([...roots, ...subCats]);
  } else {
    const siblings = normalized.filter(c => c.parentId === cat.parentId);
    const currIdx = siblings.findIndex(c => c.id === catId);
    if (currIdx === -1) return normalized;

    const [item] = siblings.splice(currIdx, 1);
    const insertIdx = Math.min(Math.max(0, targetOrder - 1), siblings.length);
    siblings.splice(insertIdx, 0, item);
    siblings.forEach((s, idx) => { s.order = idx + 1; });

    const otherCats = normalized.filter(c => c.parentId !== cat.parentId);
    return normalizeCategories([...otherCats, ...siblings]);
  }
}
