var Grid = require("./grid").Grid;
var Cell = require("./cell").Cell;
var util = require("./util");

exports.Sheet = util.Class(function Sheet(def) {
  this.inherit(util.Evented);

  def.constructor = function(owner, name, data) {
    util.Evented.constructor.call(this);
    this.name = name;
    this.owner = owner;
    this.grid = new Grid(16384, 1048576, 1024);
    this._data = data || {};
    if(!this._data.rows) { this._data.rows = {}; }
    this.rows = {};
    this._initData();
  };

  def._initData = function() {
    for(var rowIndex in this._data.rows) {
      for(var cellIndex in this._data.rows[rowIndex]) {
        this._createCell(Number(cellIndex), Number(rowIndex));
      }
    }
  };

  def.area = function() {
    if(!this._data.rows) { return [0,0]; }
    var y = 0, x = 0;
    for(var rowIndex in this._data.rows) {
      y = Math.max(Number(rowIndex), y);
      for(var cellIndex in this._data.rows[rowIndex]) {
        x = Math.max(Number(rowIndex), y);
      }
    }
    return [x,y];
  };

  def.deleteCell = function(x, y) {
    if(!this._data.rows[y]) return;
    if(this._data.rows && this._data.rows[y]) delete this._data.rows[y][x];
    if(this.rows && this.rows[y]) delete this.rows[y][x];
    for(var key in this._data.rows[y]) return;
    if(this._data.rows) delete this._data.rows[y];
    if(this.rows) delete this.rows[y];
  };

  def._createCell = function(x, y) {
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
      this._cell(cell);
    }
    return cell;
  };

  def._cell = function(cell) {
    var self = this;
    cell.onAny(function(evt) {
      var evt = util.clone(evt) || {};
      evt.cell = cell;
      self.emit("cell." + this.event, evt);
    });
  };

  def.sizes = function() {
    var results = this._data.sizes;
    if(results === undefined) {
      results = this._data.sizes = {}
    }
    if(!results.x) results.x = {};
    if(!results.y) results.y = {};
    return results;
  };

  def.meta = function(name, range, value) {
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
  };

  def._metaContainer = function(name, create) {
    var info = this._data[name];
    if(info === undefined && create !== false) {
      info = this._data[name] = [];
    }
    return info;
  };

  def.cell = function(x, y, create) {
    if(arguments.length < 3) {
      create = true;
    }
    var row = this.rows[y];
    var cell = row ? row[x] : null;
    if(!cell && create) {
      return this._createCell(x, y);
    }
    return cell;
  };
});

