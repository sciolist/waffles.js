var util = require("./util");

exports.Span = util.Evented.extend({
  init: function(sheet, x, y, width, height) {
    this.x = x || 0;
    this.y = y || 0;
    this.width = width || 0;
    this.height = height || 0;
    this.sheet(sheet);
  },
  destroy: function() {
    if(this._sheetChange) this._sheetChange();
    util.Evented.prototype.destroy.call(this);
    this._sheet = null;
  },
  sheet: function(sheet) {
    if(arguments.length === 0) return this._sheet;
    if(this._sheet === sheet) return;
    var self = this;
    if(this._sheetChange) this._sheetChange();
    this._sheet = sheet;
    this._sheetChange = sheet.on("*", function(evt) {
      if(!evt.cell || !self.contains(evt.cell)) return;
      self.emit(evt.type, util.clone(evt));
      if(evt.cell && evt.type == "cell:changed") {
        self.emit("changed", util.clone(evt));
      }
    });
    this.emit("moved");
    this.emit("changed");
  },
  cell: function(x, y, create) {
    if(arguments.length < 3) create = true;
    if(!this.contains(x, y)) { throw new Error("Index outside span."); }
    return this._sheet.cell(x+this.x, y+this.y, create);
  },
  cells: function(sorted) {
    var grid = this._sheet.grid;
    return this._sheet.grid.between([this.x,this.y], [this.x+this.width,this.y+this.height], sorted);
  },
  values: function(sorted) {
    var grid = this._sheet.grid;
    var cells = grid.between([this.x,this.y], [this.x+this.width,this.y+this.height], sorted);
    for(var i=0; i<cells.length; ++i) {
      cells[i] = cells[i].valueOf();
    }
    return cells;
  },
  contains: function(x, y, w, h) {
    if(arguments.length === 1) {
      var obj = x;
      x = obj.x;
      y = obj.y;
      w = obj.width === undefined ? 1 : obj.width;
      h = obj.height === undefined ? 1 : obj.height;
    }
    else if(arguments.length === 2) {
      w = h = 1;
    }
    if(x < this.x || x+w > this.x+this.width) return false;
    if(y < this.y || y+h > this.y+this.height) return false;
    return true;
  },
  size: function(w, h) {
    if(arguments.length === 0) {
      return { w: this.width, h: this.height };
    }
    if(this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.emit("resized");
    this.emit("changed");
  },
  location: function(x, y) {
    if(arguments.length === 0) {
      return { x: this.x, y: this.y };
    }
    if(this.x === x && this.y === y) return;
    this.x = x;
    this.y = y;
    this.emit("moved");
    this.emit("changed");
  },
  resizeBy: function(w, h) {
    return this.size(w+this.width,h+this.height);
  },
  moveBy: function(x, y) {
    return this.location(x+this.x,y+this.y);
  },
  valueOf: function(sorted) {
    if(this.width === this.height === 1) {
      var cell = this.cell(0, 0, false);
      return cell === undefined ? "" : cell.valueOf();
    }
    var cells = this.values(sorted);
    if(cells.length <= 1) {
      return cells[0];
    }
    return cells;
  }
});
