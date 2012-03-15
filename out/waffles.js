(function(window, undefined) {
var requireCode = {};
function require(path) {
  var data = requireCode[path];
  if(data instanceof Function) {
    var method = data;
    data = requireCode[path] = {};
    method(data);
  }
  return data;
}
requireCode["./book"] = function(exports) {
  var Sheet = require("./sheet").Sheet;
  var Span = require("./span").Span;
  var util = require("./util");
  
  exports.Book = util.Evented.extend({
    init: function(data) {
      this._data = data || {};
      if(!this._data.sheets) this._data.sheets = {};
      if(!this._data.regions) this._data.regions = {};
      this._regions = {};
      this._sheets = {};
      if(this._data.code) {
        new Function("coffeemill", this._data.code).call(this, exports);
      }
    },
    sheets: function() {
      var list = [];
      for(var key in this._data.sheets) {
        list.push(key);
      }
      return list;
    },
    sheet: function(name, create) {
      if(arguments.length === 1) create = true;
      var self = this;
      var sheet = this._sheets[name];
      if(!sheet) {
        var data = this._data.sheets[name];
        if(!data) {
          if(!create) return;
          data = this._data.sheets[name] = {};
        }
        sheet = this._sheets[name] = new Sheet(this, name, data);
        sheet.on("*", function(evt, sender) {
          var e = util.clone(evt);
          e.sheet = sender;
          self.emit("sheet:" + e.type, e);
        });
        this.emit("sheet:new", { sheet: sheet });
      }
      return sheet;
    },
    region: function(name, span) {
      if(arguments.length == 2) {
        this._data.regions[name] = {
          "sheet":span.sheet().name,
          "x":span.x,
          "y":span.y,
          "width":span.width,
          "height":span.height,
        };
        this._regions[name] = span;
        return;
      }
      if(this._regions[name]) {
        var region = this._regions.hasOwnProperty(name) ? this._regions[name] : null;
        return region;
      }
      if(this._data.regions.hasOwnProperty(name)) {
        var data = this._data.regions[name];
        var sheet = this.sheet(data.sheet, false);
        return this._regions[name] = new Span(sheet,data.x,data.y,data.width,data.height);
      }
      return null;
    }
  });
  
  
};
requireCode["./cell"] = function(exports) {
  var Scripting = require("./scripting").Scripting;
  var util = require("./util");
  
  exports.Cell = util.Evented.extend({
    init: function(owner, data, x, y) {
      if(!data) { data = { } }
      this.owner = owner;
      this.x = x;
      this.y = y;
      this._data = data;
      this.valid = this._data.value !== undefined || this._data.formula === undefined;
      this._dep = [];
    },
    name: function() {
      return Scripting.cellName(this.x+1, this.y);
    },
    formula: function(formula, value, emit) {
      if(arguments.length > 0) {
        if(arguments.length < 3) {
          emit = true;
        }
        this.valid = value !== undefined;
        this._data.formula = formula;
        if(value !== undefined) {
          this._data.value = value;
        } else {
          delete this._data.value;
        }
        delete this._error;
        if(emit) {
          this.emit("changed");
        }
        return;
      }
      return this._data.formula;
    },
    _clearDependencies: function() {
      if(!this._dep || !this._dep.length) return;
      for(var i=0, mi=this._dep.length;i<mi;++i) {
        this._dep[i].call && this._dep[i]();
      }
      this._dep = [];
    },
    dependency: function(dep) {
      this._dep.push(dep);
    },
    _createDependencies: function() {
      var self = this;
      for(var i=0; i<this._dep.length; ++i) {
        (function(i) {
          var dep = self._dep[i];
          dep.on("cell:changed", function(e) {
            self.valid = false;
            delete self._data.value;
            self.emit("changed");
          });
          self._dep[i] = function() { dep.destroy(); };
        })(i);
      };
    },
    value: function(v) {
      if(arguments.length === 0) {
        return this.valueOf();
      }
      this._data.value = v;
      this.valid = true;
      this._error = null;
      this.emit("changed");
    },
    valueOfCached: function() {
      if(this._error) throw this._error;
      var v = this._data.value;
      if(v === undefined || v === "") return "";
      if(!this._isNumeric(v)) return v.valueOf();
      return Number(v);
    },
    _isNumeric: function(v) {
      return /^\d+(\.\d+)?$/.test(v);
    },
    valueOf: function() {
      if(this._running) { throw new Error("Circular dependency"); }
      this._running = true;
      if(this.valid) {
        try {
          return this.valueOfCached();
        } catch(e) {
          console && console.error(e);
          throw e;
        } finally {
          this._running = false;
        }
      }
      var self = this;
      delete this._error;
      this.valid = false;
      this._running = true;
      this._clearDependencies();
      try {
        var value = this._data.formula;
        if(value !== undefined && value[0] === "=") {
          value = Scripting.compile(this, value.substring(1)).call(this, this);
        }
      } catch(e) {
        console && console.error(e);
        this._error = e;
        value = undefined;
      }
      this.valid = true;
      this._running = false;
      this._data.value = value;
      this._createDependencies();
      return this.valueOfCached();
    }
  });
  
  
};
requireCode["./grid"] = function(exports) {
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
  
};
requireCode["./index"] = function(exports) {
  exports.Book = require("./book").Book;
  exports.Sheet = require("./sheet").Sheet;
  exports.Macro = require("./macro").Macro;
  exports.Span = require("./span").Span;
  exports.Scripting = require("./scripting").Scripting;
  exports.util = require("./util");
  
  
};
requireCode["./macro"] = function(exports) {
  var Span = require("./span").Span;
  
  var Macro = exports.Macro = {
    VALUES: function(args) {
      var results = [];
      for(var i=0; i<args.length; ++i) {
        if(args[i] instanceof Span) {
          var cells = args[i].cells();
          if(!cells || !cells.length) continue;
          for(var q=0; q<cells.length; ++q) {
            results.push(cells[q].valueOf());
          }
        } else if(args[i] && args[i].length && !(args[i] instanceof String)) {
          for(var q=0; q<args[i].length; ++q) {
            results.push(args[i][q]);
          }
        }
        else results.push(args[i]);
      };
      return results;
    },
    REDUCE: function() {
      var args = Array.prototype.slice.call(arguments);
      var aggregator = args.pop();
      var seed = 0;
      if(!aggregator.call) {
        seed = aggregator;
        aggregator = args.pop();
      }
      if(args.length === 1 && !isNaN(args[0].length)) {
        args = Array.prototype.slice.call(args[0]);
      }
      var values = Macro.VALUES(args);
      if(seed === undefined) {
        seed = values.shift();
      }
      for(var i=0; i<values.length; ++i) {
        var value = values[i];
        if(value) value = value.valueOf();
        seed = aggregator(seed, value);
      }
      return seed;
    },
    MAP: function() {
      var args = Array.prototype.slice.call(arguments);
      var mapper = args.pop();
      if(args.length === 1 && !isNaN(args[0].length)) {
        args = Array.prototype.slice.call(args[0]);
      }
      var values = Macro.VALUES(args);
      for(var i=0; i<values.length; ++i) {
        values[i] = mapper(values[i]);
      }
      return values;
    },
    FILTER: function() {
      var args = Array.prototype.slice.call(arguments);
      var filter = args.pop();
      var values = Macro.VALUES(args);
      var results = [];
      for(var i=0; i<values.length; ++i) {
        var value = values[i];
        if(filter(value)) results.push(value);
      }
      return results;
    },
    DATE: function() { return new Date(); },
    COUNT: function() { return Macro.REDUCE(arguments, function(c, n) { return c + 1; }); },
    SUM: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Number(c + n); }, 0); },
    MIN: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Math.min(c, n); }); },
    MAX: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Math.max(c, n); }); },
    UPPER: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().toUpperCase();}); },
    LOWER: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().toLowerCase();}); },
    TRIM: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().trim();}); },
    INDEXOF: function() {
      var args = Array.prototype.slice.call(arguments);
      var startIndex = args.pop();
      var searchValue = "";
      if(isNaN(startIndex)) {
        searchValue = startIndex;
        startIndex = 0;
      }
      else searchValue = args.pop();
      return Macro.MAP(args, function(c) { return c&&c.toString().indexOf(searchValue, startIndex); });
    },
    SUBSTR: function() {
      var args = Array.prototype.slice.call(arguments);
      var startAt = args.pop();
      var length = Number.MAX_VALUE;
      if(!isNaN(args[args.length-1])) {
        length = startAt;
        startAt = args.pop();
      }
      return Macro.MAP(args, function(c) { return c&&c.toString().substr(startAt, length); });
    },
    SUB: function() {
      var args = Array.prototype.slice.call(arguments);
      var value = args.pop();
      var pattern = args.pop();
      return Macro.MAP(args, function(c) { return c&&c.toString().replace(pattern, value); });
    },
    AVG: function() {
      var values = Macro.VALUES(arguments);
      var sum = Macro.SUM(values);
      return sum / values.length;
    }
  };
  
};
requireCode["./scripting"] = function(exports) {
  var Macro = require("./macro").Macro;
  var Span = require("./span").Span;
  
  // Load CoffeeScript.
  var Coffee = typeof CoffeeScript === "undefined" ? require("coffee-script") : CoffeeScript;
  if(!Coffee.require) Coffee.require = function(v) {
    return require("coffee-script/lib/" + v.substring(1));
  }
  
  var Scripting = exports.Scripting = {};
  Scripting.SPAN_RX = /^(?:([\w\d]+)\!)?([A-Z]+\d+)(?:\:([A-Z]+\d+))?/;
  Scripting.SPAN_RX_ALT = /^(?:([\w\d]+)\!)?([A-Z]+)\:([A-Z]+)/;
  Scripting.compile = function(cell, code) {
    var sheet = cell ? cell.owner : null;
    var book = sheet ? sheet.owner : null;
  
    var parser = Coffee.require("./parser");
    var lexerClass = Coffee.require("./lexer").Lexer;
    var lexer = new lexerClass();
    
    // rewrite A1:A10 to Scripting.span("A1:A10", this)
    var old = lexerClass.prototype.identifierToken;
    lexerClass.prototype.identifierToken = function() {
      var match;
      if(!(match = Scripting.SPAN_RX.exec(this.chunk))) {
        if(!(match = Scripting.SPAN_RX_ALT.exec(this.chunk))) {
          return old.apply(this, arguments);
        }
      }
      this.token("IDENTIFIER", "Scripting.parseSpan('" + match[0] + "', cell)");
      return match[0].length;
    }
    
    // Tokenize and wrap with a return statement.
    var tokens = [
      ["RETURN", "return", 0],
      ["PARAM_START", "(", 0],
      ["IDENTIFIER", "cell", 0],
      ["PARAM_END", ")", 0],
      ["->", "->", 0],
      ["INDENT", 2, 0],
      ["OUTDENT", 2, 0] 
    ];
    var method = lexer.tokenize(code);
    method.unshift(tokens.length-1, 0);
    tokens.splice.apply(tokens, method);
  
    // Replace Macro call tokens
    for(var i=0; i<tokens.length; ++i) {
      var token = tokens[i];
      if(token[0] != "IDENTIFIER") continue;
      if(Macro.hasOwnProperty(token[1]) && token[1][0] !== "_") {
        token[1] = "Macro." + token[1];
        continue;
      }
      if(book && book.region(token[1])) {
        token[1] = "Scripting.parseSpan('" + token[1].replace("'", "\'") + "', cell)";
      }
    };
  
    var results = parser.parse(tokens);
    var js = results.compile();
    return eval(js);
  };
  Scripting.columnName = function(number) {
    var min = "A".charCodeAt(0) - 1;
    if(number <= 26) {
      return String.fromCharCode(number + min);
    } else {
      var remains = number % 26;
      var mod = parseInt(number / 26);
      if(remains == 0) {
        return Scripting.columnName(mod - 1) + "Z";
      } else {
        return Scripting.columnName(mod) + String.fromCharCode(remains + min);
      }
    }
  };
  Scripting.cellName = function(x, y) {
    return Scripting.columnName(x) + (1+y).toString();
  };
  Scripting.number = function(value, max) {
    if(!value) return null;
    var rx = /^([A-Z]+)([1-9]\d*)?$/;
    var match = value.match(rx);
    
    var column = 0;
    var min = "A".charCodeAt(0);
    var ch = match[1];
    for(var i=ch.length-1; i>=0; --i) {
      var pow = ch.length-i-1;
      var val = ch[i].charCodeAt(0) - min;
      column += Math.pow(26, pow)*(val+1);
    };
    var row = max ? 1048576 : 0;
    if(match[2]) {
      row = Number(match[2]) - 1;
    }
    var result = [ column - 1, row ];
    return result;
  };
  Scripting.parseSpan = function(value, cell) {
    var sheet = cell && cell.owner;
    var book = sheet && sheet.owner;
    var region = book && book.region(value);
    if(region) { return region; }
  
    var match = value.match(Scripting.SPAN_RX) || value.match(Scripting.SPAN_RX_ALT);
    if(match == null || match[0].length != value.length) {
      throw new Error("Invalid specifier.");
    }
  
    var targetSheet = sheet;
    if(match[1]) {
      targetSheet = sheet.owner.sheet(match[1], false);
      if(!targetSheet) {
        throw new Error("Sheet not found: ", match[1]);
      }
    }
    
    var parsedFrom = Scripting.number(match[2], false) || [0,0];
    var parsedTo = Scripting.number(match[3], true) || parsedFrom;
  
    var fromX = Math.min(parsedTo[0], parsedFrom[0]);
    var fromY = Math.min(parsedTo[1], parsedFrom[1]);
    var toX = Math.max(parsedTo[0], parsedFrom[0]);
    var toY = Math.max(parsedTo[1], parsedFrom[1]);
    var width = 1 + toX - fromX;
    var height = 1 + toY - fromY;
  
    var span = new Span(targetSheet, fromX, fromY, width, height);
    if(cell && cell.dependency) cell.dependency(span);
    return width == 1 && height == 1 ? span.valueOf() : span;
  }
  
};
requireCode["./sheet"] = function(exports) {
  var Grid = require("./grid").Grid;
  var Cell = require("./cell").Cell;
  var util = require("./util");
  
  exports.Sheet = util.Evented.extend({
    init: function(owner, name, data) {
      this.name = name;
      this.owner = owner;
      this.grid = new Grid(16384, 1048576, 1024);
      this._data = data || {};
      if(!this._data.rows) { this._data.rows = {}; }
      this.rows = {};
      this._initData();
    },
    _initData: function() {
      for(var rowIndex in this._data.rows) {
        for(var cellIndex in this._data.rows[rowIndex]) {
          this._createCell(Number(cellIndex), Number(rowIndex));
        }
      }
    },
    area: function() {
      if(!this._data.rows) { return [0,0]; }
      var y = 0, x = 0;
      for(var rowIndex in this._data.rows) {
        y = Math.max(Number(rowIndex), y);
        for(var cellIndex in this._data.rows[rowIndex]) {
          x = Math.max(Number(rowIndex), y);
        }
      }
      return [x,y];
    },
    _createCell: function(x, y) {
      var self = this;
      var dataRow = this._data.rows[y];
      if(!dataRow) {
        dataRow = this._data.rows[y + ""] = {};
      }
      var dataCell = dataRow[x];
      if(!dataCell) {
        dataCell = dataRow[x + ""] = {};
      }
      var row = this.rows[y];
      if(!row) {
        row = this.rows[y] = {};
      }
      var cell = row[x];
      if(!cell) {
        cell = row[x] = new Cell(this, dataCell, x, y);
        this.grid.add([x,y], cell);
        cell.on("*", function(evt, sender) {
          e = util.clone(evt);
          e.cell = sender;
          self.emit("cell:" + e.type, e);
        });
      }
      return cell;
    },
    sizes: function() {
      var results = this._data.sizes;
      if(results === undefined) {
        results = this._data.sizes = { x: {}, y: {} }
      }
      return results;
    },
    meta: function(name, range, value) {
      if(arguments.length < 2) { return this._metaContainer(name); }
      var set = arguments.length > 2;
      if(range instanceof Number) {
        range = new Span(this, arguments[1], arguments[2]);
        value = arguments[3];
        set = arguments.length > 3;
      } else if(set) {
        range = new Span(this, range.x, range.y, range.width||1, range.height||1);
      }
      if(set) {
        var metaData = this._metaContainer(name);
        var data = range.data();
        data.value = value;
        metaData.push(data);
        return;
      }
      var metaData = this._metaContainer(name, false);
      if(!metaData) { return; }
      var results = [];
      for(var i=0; i<metaData.length; ++i) {
        var item = metaData[i];
        if(range.x < item.x || range.y < item.y) { continue; }
        if(range.x+range.width > item.x+(item.width||1) || range.y+range.height > item.y+(item.height||1)) { continue; }
        results.push(item.value);
      }
      return results;
    },
    _metaContainer: function(name, create) {
      var info = this._data[name];
      if(info === undefined && create !== false) {
        info = this._data[name] = [];
      }
      return info;
    },
    cell: function(x, y, create) {
      if(arguments.length < 3) {
        create = true;
      }
      var row = this.rows[y];
      var cell = row ? row[x] : null;
      if(!cell && create) {
        return this._createCell(x, y);
      }
      return cell;
    }
  });
  
};
requireCode["./span"] = function(exports) {
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
    }
  });
  
};
requireCode["./util"] = function(exports) {
  exports.clone = function(obj) {
    if(obj.slice) return obj.slice(0);
    var newObject = {};
    for(var key in obj) {
      newObject[key] = obj[key];
    }
    return newObject;
  }
  
  exports.Class = function Class() { }
  exports.Class.extend = function(data) {
    var parent = this;
    if(arguments.length === 2) {
      parent = data;
      data = arguments[1];
    }
    var cls = data.init || function(){};
    cls.base = data.__proto__ = parent.prototype;
    cls.extend = arguments.callee;
    cls.prototype = data;
    return cls;
  };
  
  exports.SheetError = exports.Class.extend(Error, {
    init: function(code, msg) {
      this.code = code;
      //Error.constructor.call(this, msg);
    }
  });
  
  exports.Evented = exports.Class.extend({
    emit: function(msg, args) {
      if(!args) { args = {}; }
      if(msg !== "*") { args.type = msg; }
      args.sender = this;
  
      var listeners = this._msgs && this._msgs[msg];
      if(listeners) {
        var handlers = listeners.slice(0);
        for(var i=0; i<handlers.length; ++i) {
          handlers[i].call(this, args, this);
        };
      }
      if(msg !== "*") {
        this.emit("*", args);
      }
    },
    unbind: function(msg, method) {
      if(!this._msgs || !this._msgs[msg]) { return; }
      for(var i=this._msgs[msg].length-1; i>=0; --i) {
        if(this._msgs[msg][i] === method) {
          this._msgs[msg].splice(i, 1);
        }
      }
      if(this._msgs[msg].length === 0) {
        delete this._msgs[msg];
      }
    },
    on: function(msg, method) {
      var self = this;
      if(!this._msgs) this._msgs = {};
      if(!this._msgs[msg]) this._msgs[msg] = [];
      this._msgs[msg].push(method);
      return function() { self.unbind(msg, method); }
    },
    once: function(msg, method) {
      var self = this;
      return this.on(msg, function cb() {
        self.unbind(msg, cb);
        method.apply(this, arguments);
      });
    },
    destroy: function() {
      this._msgs = null;
    }
  });
  
  
};

window.Waffles = require('./index')
window.Waffles.require = require;
})(window);

