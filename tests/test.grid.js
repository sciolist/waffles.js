var assert = require("assert");
var Grid = require("../lib/grid").Grid;

exports.run = function(test) {
  test.that("grid: a newly created grid has no subdivisions.", function() {
    var grid = new Grid();
    assert.equal(grid[0], null);
    assert.equal(grid[1], null);
    assert.equal(grid[2], null);
    assert.equal(grid[3], null);
  });
  
  test.that("grid: items can be added to the grid.", function() {
    var grid = new Grid();
    grid.add([0, 0], "test");
  });
  
  test.that("grid: items can be retrieved from the grid.", function() {
    var grid = new Grid();
    grid.add([0, 0], "test");
    assert.equal(grid.get([0, 0]), "test");
  });
  
  test.that("grid: can retrieve nonexistant items from the grid.", function() {
    var grid = new Grid();
    assert.equal(grid.get([0, 0]), undefined);
  });
  
  test.that("grid: ranges of values can be retrieved from the grid.", function() {
    var grid = new Grid();
    grid.add([0000, 0000], "test 1");
    grid.add([5000, 5000], "test 2");
    grid.add([9999, 9999], "test 3");
    var results = ["test 1", "test 2", "test 3"];
    assert.deepEqual(grid.between([0,0], [10000, 10000], true), results);
  });
  
  test.that("grid: ranges of nonexistant values can be retrieved from the grid.", function() {
    var grid = new Grid();
    var results = [];
    assert.deepEqual(grid.between([0,0], [10000, 10000], true), results);
  });
}
