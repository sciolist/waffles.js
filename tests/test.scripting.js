var assert = require("assert");
var Book = require("../lib/book").Book;
var Scripting = require("../lib/scripting").Scripting;
var Macro = require("../lib/macro").Macro;

exports.run = function(test) {
  test.that("scripting: can compile a cell reference.", function() {
    var code = "A2";
    var method = Scripting.compile(null, code);
    var result = method();
    assert.equal(result.x, 0);
    assert.equal(result.y, 1);
    assert.equal(result.width, 1);
    assert.equal(result.height, 1);
  });
  
  test.that("scripting: can compile a span reference.", function() {
    var code = "A1:A2";
    var method = Scripting.compile(null, code);
    var result = method();
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 1);
    assert.equal(result.height, 2);
  });
  
  test.that("scripting: can compile a cross-sheet reference.", function() {
    var book = new Book({
      "sheets": {
        "Sheet2": {
          "rows": { "0": { "0": { "formula": "9" } } }
    }}});
    var cell = book.sheet("Sheet1").cell(0, 0);
    
    var code = "Sheet2!A1";
    var method = Scripting.compile(cell, code);
    var result = method(cell);
    
    assert.equal(result.cell(0, 0).valueOf(), 9);
  });
  
  test.that("scripting: can compile a macro reference.", function() {
    var code = "SUM";
    var method = Scripting.compile(null, code);
    var result = method();
    assert.equal(result, Macro.SUM);
  });
  
  test.that("scripting: can read x,y values from a cell specifier.", function() {
    assert.deepEqual(Scripting.number("A1"), [0, 0]);
    assert.deepEqual(Scripting.number("A10"), [0, 9]);
    assert.deepEqual(Scripting.number("J1"), [9, 0]);
    assert.deepEqual(Scripting.number("J10"), [9, 9]);
  });
  
  test.that("scripting: throws on invalid span specifier.", function() {
    assert.throws(function() {
      Scripting.parseSpan("Invalid");
    });
  });
  
  test.that("scripting: can create a span from a region specifier.", function() {
   var book = new Book({
      "regions": {
        "testing": { x: 0, y: 0, height: 2, width: 2, sheet: "Sheet2" }
      }
    });
    var cell = book.sheet("Sheet1").cell(0, 0);
    assert.deepEqual(Scripting.parseSpan("testing", cell), { x: 0, y: 0, width: 2, height: 2 });
  });
  
  test.that("scripting: can create a span from a span specifier.", function() {
    assert.deepEqual(Scripting.parseSpan("B2:C3"), { x: 1, y: 1, width: 2, height: 2 });
  });
}
