var assert = require("assert");
var Book = require("../lib/book").Book;
var Cell = require("../lib/cell").Cell;

exports.run = function(test) {
  test.that("cell: can be assigned a static formula value.", function() {
    var cell = new Cell({}, { });
    cell.formula("62");
    assert.equal(cell.valueOf(), 62);
  });
  
  test.that("cell: exceptions during formula calculations are rethrown.", function() {
    var cell = new Cell({}, { });
    cell.formula("=throw new Error('testing.')");
    assert.throws(function() { cell.valueOf(); });
    assert.throws(function() { cell.valueOf(); });
    cell.formula("4");
    assert.doesNotThrow(function() { cell.valueOf(); });
  });

  test.that("cell: formula values are properly updated.", function() {
    var book = new Book();
    var sheet = book.sheet("0");
    var cell = sheet.cell(1,0);
    cell.formula("=SUM(A1:A3)");
    
    sheet.cell(0,0).formula(2);
    assert.equal(cell.valueOf(), 2);
    sheet.cell(0,1).formula(3);
    assert.equal(cell.valueOf(), 5);
    sheet.cell(0,2).formula(4);
    assert.equal(cell.valueOf(), 9);
  });
  
  test.that("cell: formula change events are called once per change.", function() {
    var book = new Book();
    var sheet = book.sheet("0");
    var refreshes = 0;
    sheet.on("cell:changed", function(e) {
      e.cell.valueOf(); // make sure no events are overlapping.
      if(e.cell.x == 1 && e.cell.y == 0) { refreshes += 1; }
    });
    
    sheet.cell(1,0).formula("=SUM(A1:A3)");
    assert.equal(refreshes, 1);
    
    sheet.cell(0,0).formula(2);
    assert.equal(refreshes, 2);
    
    sheet.cell(0,1).formula(3);
    assert.equal(refreshes, 3);
    
    sheet.cell(0,2).formula(4);
    assert.equal(refreshes, 4);
  });
}
