var util = require("./util");

exports.Span = util.Evented.extend({
  init: function(sheet, x, y, width, height) {
    this.x = x || 0;
    this.y = y || 0;
    if(arguments.length <= 3) {
      this.width = 1;
      this.height = 1;
    } else {
      this.width = width || 0;
      this.height = height || 0;
    }
    this.sheet(sheet);
  },
  data: function(includeSheet) {
    var result = {
      x: this.x, y: this.y,
      width: this.width, height: this.height
    };
    if(includeSheet) {
      result.sheet = this.sheet().name;
    }
    return result;
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
    this.emit("location");
    this.emit("changed");
  },
  cell: function(x, y, create) {
    if(arguments.length < 3) create = true;
    if(x < 0 || y < 0 || x >= this.width || y >= this.height) { throw new Error("Index outside span."); }
    return this._sheet.cell(x+this.x, y+this.y, create);
  },
  containedBy: function(x, y, w, h) {
    if(arguments.length === 1) {
      var obj = arguments[0];
      x = obj.x;
      y = obj.y;
      w = obj.width === undefined ? 1 : obj.width;
      h = obj.height === undefined ? 1 : obj.height;
    } else if(arguments.length === 2) {
      w = h = 1;
    }
    if(this.x < y || this.x+this.width > x+w) return false;
    if(this.y < y || this.y+this.height > y+h) return false;
    return true;
  },
  contains: function(x, y, w, h) {
    if(arguments.length === 1) {
      var obj = arguments[0];
      x = obj.x;
      y = obj.y;
      w = obj.width === undefined ? 1 : obj.width;
      h = obj.height === undefined ? 1 : obj.height;
    } else if(arguments.length === 2) {
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
    return this.location(this.x, this.y, w, h);
  },
  location: function(x, y, w, h) {
    if(arguments.length === 0) {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    if(arguments.length === 1) {
      var to = x;
      x = to.x;
      y = to.y;
      w = to.width === undefined ? 1 : to.width;
      h = to.height === undefined ? 1 : to.height;
    }
    if(w !== undefined) {
      this.width = Math.max(0, w);
      this.height = Math.max(0, h);
      this.emit("resized");
    }
    this.x = Math.max(0, x);
    this.y = Math.max(0, y);
    this.emit("moved");
    this.emit("changed");
    return this;
  },
  resizeBy: function(w, h) {
    return this.location(this.x, this.y, w+this.width, h+this.height);
  },
  moveBy: function(x, y) {
    return this.location(x+this.x,y+this.y);
  },
  cells: function(sorted) {
    var grid = this._sheet.grid;
    return this._sheet.grid.between([this.x,this.y], [this.x+this.width,this.y+this.height], sorted);
  },
  values: function(sorted) {
    var cells = this.cells(sorted);
    for(var i=cells.length-1; i>=0; --i) {
      var value = cells[i].valueOf();
      if(value === undefined || value === "") {
        cells.splice(i, 1);
        continue;
      }
      cells[i] = value;
    }
    return cells;
  },
  valueOf: function(sorted) {
    if(this.width === this.height === 1) {
      var cell = this.cell(0, 0, false);
      var value = cell && cell.valueOf();
      return value === undefined ? "" : value;
    }
    var cells = this.values(sorted);
    if(cells.length <= 1) {
      return cells[0];
    }
    return cells;
  },
  toString: function() { return this.valueOf(); }
});
