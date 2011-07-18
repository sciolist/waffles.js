var assert = require("assert");
var Span = require("../lib/span").Span;
var Book = require("../lib/book").Book;

function testBook() {
  var book = new Book();
  return new Book({
    sheets: {
      "Sheet1": {
        "rows": {
          "0": { "0": { "formula": "10" } }
  }}}});
}

exports.run = function(test) {
  test.that("span: can determine if a point exists inside span.", function() {
    var span = new Span(testBook().sheet("Sheet1"), 1, 1, 2, 2);
    assert.ok(!span.contains(0,0));
    assert.ok(span.contains(1,1));
    assert.ok(span.contains(2,2));
    assert.ok(!span.contains(3,3));
  });
  
  test.that("span: only cells inside the span raise events", function() {
    var sheet = testBook().sheet("Sheet1");
    var span = new Span(sheet, 0, 3, 1, 3);
    var expect = [[0,3],[0,4],[0,5]];
    span.on("cell:changed", function(e) {
      var expected = expect.shift();
      assert.deepEqual(expected, [e.cell.x, e.cell.y]);
    });
    for(var y=0; y<10; ++y) {
      sheet.cell(0, y).formula("Testing");
    }
    assert.equal(expect.length, 0);
  });
  
  test.that("span: relocation moves event range.", function() {
    var hit;
    var sheet = testBook().sheet("Sheet1");
    var span = new Span(sheet, 0, 0, 1, 1);
    
    var lastHit = null;
    function reset() { lastHit = null; }
    span.on("cell:changed", function(e) { lastHit = [e.cell.x, e.cell.y]; });
    
    reset();
    sheet.cell(1, 1).formula("n");
    assert.ok(!lastHit);
    
    reset();
    span.moveBy(1, 1);
    sheet.cell(1, 1).formula("n");
    assert.deepEqual(lastHit, [1, 1]);
  });
  
  test.that("span: moving between sheets moves event range.", function() {
    var book = testBook();
    var sheet1 = book.sheet("Sheet1");
    var sheet2 = book.sheet("Sheet2");
    
    var span = new Span(sheet1, 2, 2, 1, 1);
    
    var lastHit = null;
    function reset() { lastHit = null; }
    span.on("cell:changed", function(e) { lastHit = e.cell.owner; });
    
    reset();
    sheet1.cell(2, 2).formula("n");
    assert.equal(lastHit, sheet1);
    
    reset();
    sheet2.cell(2, 2).formula("n");
    assert.equal(lastHit, null);
    
    span.sheet(sheet2);
    
    reset();
    sheet1.cell(2, 2).formula("n");
    assert.equal(lastHit, null);
    
    reset();
    sheet2.cell(2, 2).formula("n");
    assert.equal(lastHit, sheet2);
  });
  
  test.that("span: resize moves event range.", function() {
    var hit;
    var sheet = testBook().sheet("Sheet1");
    var span = new Span(sheet, 0, 0, 1, 1);
    
    var lastHit = null;
    function reset() { lastHit = null; }
    span.on("cell:changed", function(e) { lastHit = [e.cell.x, e.cell.y]; });
    
    reset();
    sheet.cell(0, 0).formula("n");
    assert.deepEqual(lastHit, [0, 0]);
    
    reset();
    sheet.cell(1, 1).formula("n");
    assert.ok(!lastHit);
    
    span.resizeBy(1, 1);
    
    reset();
    sheet.cell(0, 0).formula("n");
    assert.deepEqual(lastHit, [0, 0]);
    
    reset();
    sheet.cell(1, 1).formula("n");
    assert.deepEqual(lastHit, [1, 1]);
  });
}
