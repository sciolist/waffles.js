var util = require("./util");

exports.Span = util.Class(function Span(def) {
  this.inherit(util.Evented);

  def.constructor = function(sheet, x, y, width, height) {
    util.Evented.constructor.call(this);
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
  };

  def.clone = function() {
    return new exports.Span(this._sheet, this.x, this.y, this.width, this.height);
  };

  def.equalTo = function(other) {
    return this.sheet() === other.sheet() &&
           this.x === other.x && this.y === other.y &&
           this.width === other.width && this.height === other.height;
  };

  def.data = function(includeSheet) {
    var result = {
      x: this.x, y: this.y,
      width: this.width, height: this.height
    };
    if(includeSheet) {
      result.sheet = this.sheet().name;
    }
    return result;
  };

  def.destroy = function() {
    if(this._sheetChange) this._sheetChange();
    util.Evented.prototype.destroy.call(this);
    this._sheet = null;
  };

  def.sheet = function(sheet) {
    if(arguments.length === 0) return this._sheet;
    if(this._sheet === sheet) return;
    var self = this;
    if(this._sheetChange) this._sheetChange();
    this._sheet = sheet;

   function forward(evt) {
      var cell = evt && evt.cell;
      if(!cell || !self.contains(cell)) return;
      self.emit(this.event, evt);
      if(this.event == "cell.changed") {
        self.emit("changed", evt);
      }
    }

    sheet.on("cell.*", forward);
    this._sheetChange = function() {
      sheet.off("cell.*", forward);
    }
    
    this.emit("location");
    this.emit("changed");
  };

  def.cell = function(x, y, create) {
    if(arguments.length < 3) create = true;
    if(x < 0 || y < 0 || x >= this.width || y >= this.height) {
      throw new Error("Index outside span.");
    }
    return this._sheet.cell(x+this.x, y+this.y, create);
  };

  def.containedBy = function(x, y, w, h) {
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
  };

  def.contains = function(x, y, w, h) {
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
  };

  def.size = function(w, h) {
    if(arguments.length === 0) {
      return { w: this.width, h: this.height };
    }
    return this.location(this.x, this.y, w, h);
  };

  def.location = function(x, y, w, h) {
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
  };

  def.resizeBy = function(w, h) {
    return this.location(this.x, this.y, w+this.width, h+this.height);
  };

  def.moveBy = function(x, y) {
    return this.location(x+this.x,y+this.y);
  };

  def.cells = function(sorted) {
    var grid = this._sheet.grid;
    return this._sheet.grid.between([this.x,this.y], [this.x+this.width,this.y+this.height], sorted);
  };

  def.values = function(sorted) {
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
  };

  def.valueOf = function(sorted) {
    if(this.width === this.height === 1) {
      var cell = this.cell(0, 0, false);
      var value = cell && cell.valueOf();
      return value === undefined ? "" : value;
    }
    var cells = this.values(sorted);
    if(cells.length <= 1) {
      var value = (cells.length ? cells[0] : "").valueOf();
      return value === undefined ? "" : value;
    }
    return cells;
  };

  def.dimensions = function() { return { x: this.x, y: this.y, width: this.width, height: this.height }; },
  def.toString = function() {
    var result = this.valueOf();
    if(result === undefined) return "";
    return result.toString();
  }
});
