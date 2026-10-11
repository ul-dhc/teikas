// Split along the longer side, keeping each tile's area proportional to its count.
export function treemap(items, width = 100, height = 100) {
 const tiles = [];
 function partition(group, x, y, w, h) {
  if (!group.length) return;
  if (group.length === 1) { tiles.push({...group[0], x, y, width:w, height:h}); return; }
  const total = group.reduce((sum, item) => sum + item.count, 0);
  let split = 1, left = group[0].count;
  while (split < group.length - 1 && Math.abs(left + group[split].count - total / 2) < Math.abs(left - total / 2)) left += group[split++].count;
  const share = left / total;
  if (w >= h) {
   partition(group.slice(0, split), x, y, w * share, h);
   partition(group.slice(split), x + w * share, y, w * (1 - share), h);
  } else {
   partition(group.slice(0, split), x, y, w, h * share);
   partition(group.slice(split), x, y + h * share, w, h * (1 - share));
  }
 }
 partition(items.filter(item => item.count > 0), 0, 0, width, height);
 return tiles;
}
