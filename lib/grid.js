exports.Grid = function Grid(w, h, minSize) {
  if(w === undefined) w = 16384;
  if(h === undefined) h = w;
  if(minSize === undefined) minSize = Math.max(1, Math.max(w, h) / 1024);

  this.root = {x:0,y:0,w:w,h:h};
  this.minSize = minSize;
}
exports.Grid.prototype.get = function(at) {
  var current = this.root;
  while(current) {
    if(current.items !== undefined) {
      for(var i=0; i<current.items.length; ++i) {
        var item = current.items[i];
        if(item.at[0] === at[0] && item.at[1] === at[1]) {
          return item.obj;
        }
      }
      return;
    }
    var dx = current.x + current.w/2 <= at[0] ? 1 : 0;
    var dy = current.y + current.h/2 <= at[1] ? 1 : 0;
    var d = dx | dy << 1;
    current = current[d];
  }
};
exports.Grid.prototype.between = function(min, max, sorted) {
  var stack = [this.root];
  var results = [];
  while(stack.length) {
    var current = stack.pop();
    if(current === undefined) continue;
    if(max[0] <= current.x || min[0] >= current.x+current.w) continue;
    if(max[1] <= current.y || min[1] >= current.y+current.h) continue;
    if(current.items !== undefined) {
      for(var i=0, mi=current.items.length; i<mi; ++i) {
        var item = current.items[i], at = item.at;
        if(at[0] < min[0] || at[0] >= max[0]) continue;
        if(at[1] < min[1] || at[1] >= max[1]) continue;
        results.push(sorted ? item : item.obj);
      }
      continue;
    }
    stack.push(current[0], current[1], current[2], current[3]);
  }
  if(!sorted) return results;
  results = results.sort(function(a, b) {
    return a.at[0] - b.at[0] || a.at[1] - b.at[1];
  });
  var arr = new Array(results.length);
  for(var i=0, mi=results.length; i<mi; ++i) {
    arr[i] = results[i].obj;
  }
  return arr;
}
exports.Grid.prototype.add = function(at, obj) {
  var current = this.root;
  var node = { at: at, obj: obj };
  while(current) {
    if(current.items !== undefined) {
      current.items.push(node);
      return;
    }
    var dx = current.x + current.w/2 <= at[0] ? 1 : 0;
    var dy = current.y + current.h/2 <= at[1] ? 1 : 0;
    var d = dx | dy << 1;
    if(current[d]) {
      current = current[d];
      continue;
    }
    var n = current[d] = {
      x: current.x + (dx ? current.w/2 : 0),
      y: current.y + (dy ? current.h/2 : 0),
      w: current.w/2,
      h: current.h/2
    }
    if(n.w <= this.minSize && n.h <= this.minSize) {
      n.items = [node];
      return;
    }
    current = n;
  }
}
