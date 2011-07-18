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
