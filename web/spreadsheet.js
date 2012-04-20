function locate(em, add, top) {
  var result = [0, 0];
  if(add) {
    result[0] += em.offsetWidth;
    result[1] += em.offsetHeight;
  }
  while(em && em != top) {
    result[0] += em.offsetLeft;
    result[1] += em.offsetTop;
    em = em.offsetParent;
  }
  return result;
};



var Highlight = Waffles.util.Class(function Highlight(def) {

  def.constructor = function(spreadsheet, span, element) {
    this.span = span;
  };

  def.applyTo = function(spreadsheet, em) {
    var cells = this.minMax(spreadsheet);
    $(em).removeClass("hide-left hide-right hide-top hide-bottom");
    em.className += cells.className;
    if(!cells.min || !cells.max) {
      em.style.cssText = "display:none;"
      return false;
    }
    var start = locate(cells.min, false, spreadsheet.em[0]);
    var end = locate(cells.max, true, spreadsheet.em[0]);
    em.style.cssText = [
      "position:absolute",
      "left:" + (start[0]) + "px",
      "top:" + (start[1]) + "px",
      "width:" + (end[0]-start[0]) + "px",
      "height:" + (end[1]-start[1]) + "px",
      "display:block"
    ].join(";");
      return true;
  };

  def.minMax = function(spreadsheet) {
    var span = spreadsheet.span;

    var minX = this.span.x - span.x;
    var maxX = minX + this.span.width - 1;

    var minY = this.span.y - span.y;
    var maxY = minY + this.span.height - 1;

    var min = spreadsheet.cellAt(Math.max(0,minX), Math.max(0,minY));
    var max = spreadsheet.cellAt(Math.min(span.width-2,maxX), Math.min(span.height-2,maxY));

    var className = "";
    if(minX <  0) className += " hide-left";
    if(maxX >= span.width) className += " hide-right";
    if(minY <  0) className += " hide-top";
    if(maxY >= span.height) className += " hide-bottom";

    return {
      min: min[0],
      max: max[0],
      className: className
    };
  };

});

var Spreadsheet = Waffles.util.Class(function Spreadsheet(def) {

  def.constructor = function(em, book) {
    var self = this;
    this.queue = [];
    this.book = book;

    this.em = $("<div>").addClass("spreadsheet");
    $(em).append(this.em);

    var sheet = book.sheet("Sheet1");
    this.span = new Waffles.Span(sheet, 0, 0, 10, 10);
    this.selection = new Waffles.Span(sheet, 0, 0, 1, 1);
    this.selectionAt = new Waffles.Span(sheet, 0, 0, 1, 1);
    this.selectionFocus = new Waffles.Span(sheet, 0, 0, 1, 1);
    
    this.selectionFocus.on("moved", function() {
      self.selectionAt.location(this);
    });
    this.selection.on("changed", function() {
      self.scrollToFocus();
      self.updateSelection();
    });
    this.span.on("moved", function() {
      self.hideEditInput();
      refreshValues = true;
    });
    this.span.on("cell.changed", function(e) {
      var span = this;
      self.queue.push(function() { refreshInnerValues = true; });
    });

    this.createVerticalScroll();
    this.createHorizontalScroll();
    this.createEditInput();
    this.refreshValues();
    this.createSelectionDragger();
    this.selectionSetup();
    this.selectionHighlight = new Highlight(this, this.selection, this._selection);
    
    this.table.mousedown(function(e) {
      e.preventDefault();
    });
    this.em.mouseup(function() {
      self._input.focus();
    });

    var refreshValues = false;
    var refreshInnerValues = false;
    setInterval(function() {
      if(refreshValues) { self.refreshValues(); refreshValues = refreshInnerValues = false; }
      if(refreshInnerValues) { self.refreshInnerValues(); refreshInnerValues = false; }
      while(self.queue.length) {
        self.queue.pop()();
      }
    }, 16);

    $(function() {
      $(em).prepend(self._table)
      $(window).bind("resize", function() {
        self.refreshValues();
        self.updateSelection();
      });
      self.updateSelection();
      self.refreshValues();
    });
  };

  def.showFormulas = false,
  
  def.createVerticalScroll = function() {
    var self = this;
    var area = this.span.sheet().area();
    var updatingScroll = false;
    var updatingMove = false;
    
    function refreshSize(value) {
      var area = self.span.sheet().area();
      var max1 = value + self.span.height;
      var max2 = area[1];
      bar.opts.currentMax = (Math.max(max1, max2)+10)|0;
      bar.scroll();
    }

    var bar = new ScrollBar(this.em, {
      delegate: true,
      axis: 2,
      min: 0,
      scale: 1,
      max: area[1] + self.span.height,
      step: 1,
      scroll: function(value) {
        if(isScrolling) return;
        isScrolling = true;
        var value = bar.value()|0;
        refreshSize(value);
        self.span.location(self.span.x, value);
        isScrolling = false;
      }
    });
    
    var isScrolling = false;
    
    this.span.on("resized", function() {
      refreshSize(bar.value());
    });
    
    this.span.on("moved", function() {
      if(isScrolling) { return; }
      isScrolling = true;
      bar.scroll(self.span.y * 10);
      refreshSize(bar.value());
      isScrolling = false;
    });
    
  },
  
  def.createHorizontalScroll = function() {
    var self = this;
    var area = this.span.sheet().area();
    var updatingScroll = false;
    var updatingMove = false;
    
    function refreshSize(value) {
      var area = self.span.sheet().area();
      var max1 = value + self.span.width;
      var max2 = area[0];
      bar.opts.currentMax = (Math.max(max1, max2)+10)|0;
      bar.scroll();
    }
    
    var bar = new ScrollBar(this.em, {
      delegate: true,
      axis: 1,
      dir: "x",
      min: 0,
      scale: 1,
      max: area[0],
      step: 1,
      scroll: function(value) {
        if(isScrolling) return;
        isScrolling = true;
        var value = this.value();
        refreshSize(value);
        self.span.location(value, self.span.y);
        isScrolling = false;
      }
    });
    
    var isScrolling = false;
    
    this.span.on("resized", function() {
      refreshSize(bar.value());
    });
    
    this.span.on("moved", function() {
      if(isScrolling) { return; }
      isScrolling = true;
      bar.scroll(self.span.x * 10);
      refreshSize(bar.value());
      isScrolling = false;
    });
  };




  // SELECTION BOX
  def.createSelectionDragger = function() {
    this._selection = $("<div>").addClass("selection-wrapper");
    $("<div>").addClass("selection").appendTo(this._selection);
    $("<div>").addClass("drag").appendTo(this._selection);
    this.em.prepend(this._selection);
  };
  def.selectionRing = function() {
    if(!this._selection) { return; }
    this.selectionHighlight.applyTo(this, this._selection[0]);
  };

  def.select = function(fromCell, toCell) {
    this.hideEditInput();
    this.selectionFocus.location(this.getSpanXY(fromCell));
    if(arguments.length > 1) {
      this.selectionAt.location(this.getSpanXY(toCell));
    }
  };

  def.getSpanXY = function(cell) {
    if(cell.attr) {
      return {
        x: this.span.x + Number(cell[0]["data-x"]),
        y: this.span.y + Number(cell[0]["data-y"])
      }
    }
    return {x: this.span.x + cell.x, y: this.span.y + cell.y };
  },

  def.selectionRefresh = function() {
    this.selection.location(
      Math.min(this.selectionFocus.x , this.selectionAt.x),
      Math.min(this.selectionFocus.y , this.selectionAt.y),
      Math.abs(this.selectionFocus.x - this.selectionAt.x) + 1,
      Math.abs(this.selectionFocus.y - this.selectionAt.y) + 1
    );
    this.scrollToFocus();
  };

  def.selectionSetup = function() {
    var self = this;
    var startAt = 0;
    var mxy = null;
    var dragTarget = null;
    var dragMode = null;

    $(document).bind("mouseup", "click", function(e) {
      dragMode = null;
    });

    this.table.delegate("th.xy", "click", function(e) {
      var sheet = self.span.sheet();
      self.selectionFocus.location(self.span.x, self.span.y);
      self.selectionAt.location(sheet.width, sheet.height);
      self.selectionRefresh();
    });

    // Header X
    this.table.delegate("th.x", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "header-x";

      var height = self.span.sheet().height;
      var x = Number(this["head-x"]) + self.span.x;
      var width = 1;

      self.selectionAt.location(x, self.span.y, 1, 1);
      self.selectionFocus.location(x, self.span.y, 1, 1);
      self.selection.location(x, 0, width, height);
      startAt = x;
    });
    this.table.delegate("th.x", "mouseover", function(e) {
      if(dragMode !== "header-x") { return; }

      e.preventDefault();
      var height = self.span.sheet().height;
      var x = Number(this["head-x"]) + self.span.x;
      var width = startAt + 1 - x;
      if(width <= 0) {
        width = x + 1 - startAt;
        x = startAt;
      }
      self.selection.location(x, 0, Math.max(1, width), height);
    });

    // Header Y
    this.table.delegate("th.y", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "header-y";

      var width = self.span.sheet().width;
      var y = Number(this["head-y"]) + self.span.y;
      var height = 1;

      self.selectionAt.location(self.span.x, y, 1, 1);
      self.selectionFocus.location(self.span.x, y, 1, 1);
      self.selection.location(0, y, width, height);
      startAt = y;
    });
    this.table.delegate("th.y", "mouseover", function(e) {
      if(dragMode !== "header-y") { return; }

      e.preventDefault();
      var width = self.span.sheet().width;
      var y = Number(this["head-y"]) + self.span.y;
      var height = startAt + 1 - y;
      if(height <= 0) {
        height =  y - startAt;
        y = startAt;
      }
      self.selection.location(0, y, width, Math.max(1, height));
    });

    // Oh dear lord
    setInterval(function() {
      if(!dragMode || !mxy) return;

      var inSheet = $(dragTarget).closest("div.spreadsheet").length > 0;
      var inCell = $(dragTarget).closest("tr").length > 0;

      switch(dragMode) {
        case "cell":
          if(inSheet) return;
          self.selectionAt.location(mxy.x + self.span.x, mxy.y + self.span.y);
          self.selectionRefresh();
          break;
        case "header-x":
          if(inSheet && !inCell) return;
          var height = self.span.sheet().height;
          var x = Math.max(0, mxy.x + self.span.x);

          self.selectionAt.location(x, 0);
          var width = Math.abs(self.selectionFocus.x - x) + 1;
          x = Math.min(x, self.selectionFocus.x);
          self.selection.location(x, 0, Math.max(1, width), height);
          self.selectionRefresh();
          break;
        case "header-y":
          if(inSheet && !inCell) return;
          var width = self.span.sheet().width;
          var y = Math.max(0, mxy.y + self.span.y);

          self.selectionAt.location(0, y);
          var height = Math.abs(self.selectionFocus.y - y) + 1;
          y = Math.min(y, self.selectionFocus.y);
          self.selection.location(0, y, width, Math.max(1, height));
          self.selectionRefresh();
          break;

      }

    }, 40);

    $(document).mousemove(function(e) {
      mxy = null;
      if(!dragMode) return;
      dragTarget = e.target;
      var emXY = self.em.offset();
      var sizes = self.span.sheet().sizes();
      var mouseX = e.pageX - emXY.left, invX = mouseX < 0;
      var mouseY = e.pageY - emXY.top, invY = mouseY < 0;

      var dx = -1;
      while(true) {
        var w = (sizes[dx + self.span.x] || self.defaultWidth) + 4;
        mouseX += invX ? w : -w;
        if(invX ? mouseX > 0 : mouseX < 0) break;
        dx += invX ? -1 : 1;
      }

      var dy = -1;
      while(true) {
        var h = (sizes[dy + self.span.y] || self.defaultHeight) + 4;
        mouseY += invY ? h : -h;
        if(invY ? mouseY > 0 : mouseY < 0) break;
        dy += invY ? -1 : 1;
      }
      mxy = { x: dx, y: dy };
     });

    // CELLS
    this.table.delegate("td", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "cell";
      var x = this["data-x"], y = this["data-y"];
      if(e.shiftKey) self.selectionAt.location(self.span.x + x, self.span.y + y);
      else self.selectionFocus.location(self.span.x + x, self.span.y + y);
      self.selectionRefresh();
    });
    this.table.delegate("td", "mouseover", function(e) {
      if(dragMode !== "cell") { return; }
      var x = this["data-x"], y = this["data-y"];
      self.selectionAt.location(self.span.x + x, self.span.y + y);
      self.selectionRefresh();
    });

    this.table.delegate("td", "dblclick", function(e) {
      self.select.call(self, $(this));
      self.showEditInput();
    });
  };





  // INPUT SETUP
  def.createEditInput = function() {
    var self = this;
    var inputWrapper = this._inputWrapper = $("<div>").addClass("hidden").addClass("input-wrapper").appendTo(this.em);
    var input = this._input = $("<textarea wrap=off>").addClass("input").appendTo(inputWrapper);
    var em = input[0];

    input.keyup(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");
      switch(e.which) {
          case 27:
            self.hideEditInput(false);
            if(!isVisible) { self.showEditInput(); }
            e.preventDefault();
            break;
      }
      if(isVisible) self.fitEditInput();
    });
    
    input.keydown(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");

      if(isVisible) {
        // Runs in edit mode.
        switch(e.which) {
          case 37: // L
            if(e.ctrlKey || (em.selectionStart === 0 && em.selectionEnd === 0)) {
              self.hideEditInput();
              self.moveSelection(e.shiftKey, -1, 0);
            }
            break;
          case 39: // R
            if(e.ctrlKey || (em.selectionStart === em.value.length && em.selectionEnd === em.value.length)) {
              self.hideEditInput();
              self.moveSelection(e.shiftKey, 1, 0);
            }
            break;          
          case 38: // U
            self.hideEditInput();
            self.moveSelection(e.shiftKey, 0, -1);
            break;
          case 40: // D
            self.hideEditInput();
            self.moveSelection(e.shiftKey, 0, 1);
            break;
          case 13:
            self.hideEditInput();
            self.moveSelection(false, 0, e.shiftKey ? -1 : 1);
            break;
        }
        return;
      }

      // Runs OUTSIDE edit mode.
      switch(e.which) {
        case 27:
        case 16:
        case 17:
        case 18: 
        case 224:
          break;
        case 13: // enter
          if(e.ctrlKey) {
            self.showEditInput();
            return;
          }
          self.hideEditInput();
          self.moveSelection(false, 0, e.shiftKey ? -1 : 1);
          break;
        case 37: // L
          self.moveSelection(e.shiftKey, -1, 0);
          break;
        case 38: // U
          self.moveSelection(e.shiftKey, 0, -1);
          break;
        case 39: // R
          self.moveSelection(e.shiftKey, 1, 0);
          break;
        case 40: // D
          self.moveSelection(e.shiftKey, 0, 1);
          break;

        case 32: // Space
        case 33: // PgUp
          self.moveSelection(e.shiftKey, 0, -self.span.height);
          break;
        case 34: // PgDn
          self.moveSelection(e.shiftKey, 0, self.span.height);
          break;
        case 35: // End
          self.moveSelection(e.shiftKey, self.span.width, 0);
          break;
        case 36: // Home
          self.moveSelection(e.shiftKey, -self.span.width, 0);
          break;

        default:
          self.showEditInput();
          break;
      }
    });
  };


















  def.editInputVisible = function() {
    return !this._inputWrapper.hasClass("hidden");
  };

  def.scrollToFocus = function() {
    this._scrollToFocus = true;
    var dx = 0, dy = 0;
    dx = this.selectionAt.x - this.span.x;
    dy = this.selectionAt.y - this.span.y;
    if(dx > 0) dx -= dx >= this.span.width  - 3 ? this.span.width  - 3 : dx;
    if(dy > 0) dy -= dy >= this.span.height - 3 ? this.span.height - 3 : dy;
    this.span.moveBy(dx, dy);
    this._scrollToFocus = false;
  };

  def.dataCell = function(cell, create) {
    var x = Number(cell.x||cell[0]["data-x"]);
    if(x == null) { return; }
    var y = Number(cell.y||cell[0]["data-y"]);
    return this.span.cell(x, y, !!create);
  };

  def.hideEditInput = function(update) {
    if(this._inputWrapper.hasClass("hidden")) { return; }
    this._inputWrapper.addClass("hidden");
    this._inputWrapper[0].style.cssText = "";
    var newValue = this._input.val();
    if(update !== false) {
      var dataCell = this.selectionFocus.cell(0,0,!!newValue);
      if(dataCell && dataCell.formula() != newValue) {
        dataCell.formula(newValue);
      }
    }
    this._input.val("").select();
  };

  def.fitEditInput = function() {
    var sel = this.selectionFocus;
    var cell = this.cellAt(sel.x - this.span.x, sel.y - this.span.y);

    var w = cell.outerWidth();
    var requires = this._input[0].scrollWidth - 2;
    var maxX = this.span.x + this.span.width - 1;
    var x = 1;

    if(requires > this._input.width()) {
      while(w < requires) {
        var cell = this.cellAt(x + sel.x - this.span.x, sel.y - this.span.y);
        if(!cell || sel.x + x >= maxX) break;

        w += cell.outerWidth();
        x += 1;
      }
      this._input.width(w);
    }

    if(jQuery.browser.mozilla) { // FF doesn't autoscroll in wrap=off textareas..
      this._input[0].scrollLeft = this._input[0].selectionStart;
    }
  };

  def.showEditInput = function(updateValue) {
    this.scrollToFocus();

    var cellLocation = {x:this.selectionFocus.x,y:this.selectionFocus.y};
    var cell = this.cellAt(cellLocation.x-this.span.x, cellLocation.y-this.span.y);
    if(!cell) { return; }
    var dataCell = this.dataCell(cell, false);
    this._inputWrapper.offset(cell.offset()).removeClass("hidden");
    this._input.width(cell.outerWidth())
      .height(cell.outerHeight())
      .css("line-height", cell[0].childNodes[0].style.lineHeight);
    if(updateValue !== false) {
      this._input.val(dataCell ? dataCell.formula() : "").select();
    }
    this.fitEditInput();
  };


  def.assignValue = function(node, dataCell) {
    if(node.length) { node = node[0]; }
    if(node.nodeName[0]==="T") { node = node.childNodes[0].childNodes[0].childNodes[0]; }
    var td = node.parentNode.parentNode.parentNode;
    if(td.className !== "") td.className = "";

    var value;
    try {
      if(dataCell) {
        value = this.showFormulas ? dataCell.formula() : dataCell.valueOf();
      }
      if(value === undefined) { value = ""; }
    } catch(e) {
      td.className += " error";
      value = this.getErrorMessage(e);
    }
    if(node.nodeValue !== value) {
      node.nodeValue = value;
    }
    if(dataCell) this.resizeToFit(node.parentNode, dataCell);
  };

  def.getErrorMessage = function(err) {
    if(err.message) return err.message;
    return "#ERR";
  };

  // Fills up empty neighbours if a cell is overflowing.
  def.resizeToFit = function(node, dataCell, log) {
    var self = this;
    var reset = [];

    var w = $(node).parent().width(), x = 1;
    $(node).width(w);
    var requires = node.scrollWidth - 4;
    var last = $(node).closest("td");

    var needsResizing = w < requires;
    while(w < requires) {
      var nextEm = this.cellAt(dataCell.x + x - this.span.x, dataCell.y - this.span.y)[0];
      if(!nextEm) { break; }
      var text = nextEm.childNodes[0].childNodes[0].childNodes[0];
      if(text && /[^\s]/.test(text.nodeValue)) break;
      if(last) last.addClass("overflowing-from");
      last = $(nextEm).closest("td");
      last.addClass("overflowing-into");
      last.addClass("overflowing");
      w += nextEm.offsetWidth + 2;
      x += 1;
    }

    if(!needsResizing) return;
    if(x > 1) {
      $(node).width(w).closest("td").addClass("overflowing overflowing-from");
    }
  };


  def.headersInSpan = function headersInSpan(span) {
    var result = [];
    var tbl = this.table[0];
    var minY = span.y - this.span.y + 1;
    var maxY = minY + span.height;
    var minX = span.x - this.span.x + 1;
    var maxX = minX + span.width;
    for(var y=Math.max(0, minY), my=Math.min(maxY, this.span.height); y<my; ++y) {
      var em = tbl.rows[y];
      if(y > 0 && em) result.push(em.cells[0]);
    }
    for(var x=Math.max(0, minX), mx=Math.min(maxX, this.span.width); x<maxX; ++x) {
      var row = tbl.rows[0];
      var em = row ? row.cells[x] : null;
      if(x > 0 && em) result.push(em);
    }
    return $(result);
  };

  def.cellsInSpan = function cellsInSpan(span) {
    var result = [];
    var tbl = this.table[0];
    var minY = span.y - this.span.y + 1;
    var maxY = minY + Math.min(this.span.height, span.height);
    var minX = span.x - this.span.x + 1;
    var maxX = minX + Math.min(this.span.width, span.width);
    for(var y=minY; y<maxY; ++y) {
      var em = tbl.rows[y];
      if(!em) continue;
      for(var x=minX; x<maxX; ++x) {
        em = em.cells[x];
        if(x > 0 && em) result.push(em);
      }
    }
    return $(result);
  };

  def.cellAt = function(x, y) {
    if(x < 0 || y < 0) { return $(); }
    var rows = this.table[0].rows;
    if(!rows || rows.length <= y+1) { return $(); }
    var cells = rows[y+1].cells;
    if(!cells) { return $(); }
    return $(cells[x+1]);
  };

  def.updateSelection = function updateSelection() {
    this.table.find(".selected").removeClass("selected");
    this.headersInSpan(this.selection).addClass("selected");
    this.cellsInSpan(this.selectionFocus).addClass("selected");
    this.selectionRing();
    if(!this.span.contains(this.selectionFocus)) {
      this.hideEditInput();
    }
    if(this.editInputVisible()) {
      this.showEditInput(false);
    }
  };
  
  def.moveSelection = function(resize, x, y) {
    if(resize) {
      this.selectionAt.moveBy(x, y);
    } else {
      this.selectionFocus.moveBy(x, y);
    }
    this.selectionRefresh();
  };

  def.defaultWidth = 80;
  def.defaultHeight = 26;

  def.refreshInnerValues = function refreshInnerValues() {
    var cells = this.span.cells();
    var cellMap = {};
    for(var i=0; i<cells.length; ++i) {
      cellMap[(cells[i].y) + "_" + (cells[i].x)] = cells[i];
    }
    
    var table = this.table[0];
    for(var y=table.rows.length-1; y>=1; --y) {
      var row = table.rows[y];
      for(var x=row.cells.length-1; x>=1; --x) {
        var cell = row.cells[x];
        var dataCell = cellMap[(y + this.span.y - 1) + "_" + (x + this.span.x - 1)];
        this.assignValue(cell, dataCell);
      }
    }
  };

  def.refreshValues = function refreshValues() {
    if(!this.table) {
      this.table = $("<table>").appendTo(this.em);
    }

    var self = this;
    var defaultWidth = this.defaultWidth;
    var defaultHeight = this.defaultHeight;
    var tbl = this.table, tblEm = tbl[0];
    var sizes = this.span.sheet().sizes();

    var fullWidth = this.em[0].offsetWidth, fullHeight = this.em[0].offsetHeight;
    var mx, currentWidth;
    for(mx=0, currentWidth=defaultWidth; currentWidth < fullWidth; ++mx) {
      currentWidth += (sizes.x[this.span.x + mx] || defaultWidth);
    }
    var my, currentHeight;
    for(my=0, currentHeight=defaultHeight; currentHeight < fullHeight; ++my) {
      currentHeight += (sizes.y[this.span.y + my] || defaultHeight);
    }
    if(this.span.width != mx || this.span.height != my) {
      this.span.size(mx, my);
      return;
    }
    
    if(this._refreshCache && this._refreshCache.equalTo(this.span)) return;
    this._refreshCache = Waffles.util.clone(this.span);

    tbl.width(currentWidth);
    for(var y=my+1; ; ++y) {
      var row = tblEm.rows[y];
      if(!row) break;
      try { tblEm.removeChild(row); } catch(e) { }
    }

    for(var y=0; y<=my; ++y) {
      var row = tblEm.rows[y] || $("<tr>").appendTo(tbl)[0];
      var rowHeight = (sizes.y[this.span.y + y - 1] || defaultHeight) + "px";

      for(var x=mx+1; ;++x) {
        var cell = row.cells[x];
        if(!cell) break;
        row.removeChild(cell);
      }

      for(var x=0; x<=mx; ++x) {
        var cellWidth = (sizes.x[this.span.x + x - 1] || defaultWidth) + "px"
        var cell = row.cells[x];
        var newCell = !cell;

        if(newCell) {
          cell = $(x === 0 || y === 0 ? "<th>" : "<td>").appendTo(row)[0];
          var text = document.createElement("div");
          text.appendChild(document.createTextNode(""));

          var wrapper = document.createElement("div");
          wrapper.appendChild(text);
          cell.appendChild(wrapper);
        
          if(x === 0 && y === 0) {
            // TOP LEFT HEADER
            cell.className = "xy";
            cell.style.height = defaultHeight + "px";
            cell.style.width = defaultWidth + "px";
          } else if(x === 0) {
            // LEFT HEADER
            cell.className = "y";
            cell.setAttribute("data-header-y", y-1);
            cell["head-y"] = y - 1;
            cell.style.width = defaultWidth + "px";
          } else if(y === 0) {
            // TOP HEADER
            cell.className = "x";
            cell["head-x"] = x - 1;
            cell.style.height = defaultHeight + "px";
          } else {
            cell["data-x"] = x - 1;
            cell["data-y"] = y - 1;
          }

          cell.childNodes[0].style.width = cell.style.width;
          cell.childNodes[0].style.height = cell.style.height;
          cell.childNodes[0].style.lineHeight = cell.style.height;
        }

        var text = cell.childNodes[0].childNodes[0].childNodes[0];
        if(x === 0 && y === 0) continue;
        var newValue = undefined;

        if(x === 0) {
          newValue = this.span.y + y;
          cell.style.height = rowHeight;
        } else if(y === 0) {
          newValue = Waffles.Scripting.columnName(this.span.x+x);
          cell.style.width = cellWidth;
        } else {
          
          if (cellWidth !== cell.style.width) {
            cell.style.width = cellWidth;
            cell.childNodes[0].style.width = cell.style.width;
          }
          if (rowHeight !== cell.style.height) {
            cell.style.height = rowHeight;
            cell.childNodes[0].style.lineHeight = cell.childNodes[0].style.height = cell.style.height;
          }
        }

        if(newValue !== undefined && text.nodeValue !== newValue) {
          text.nodeValue = newValue;
        }
      }
    }
    this.refreshInnerValues();
    this.updateSelection();
  }
});

