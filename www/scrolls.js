(function(jQuery, window, undefined) {
  
  var bind = function(fn, scope) {
    return function() { return fn.apply(scope, arguments); }
  }

  ScrollBar = function(parent, opts) {
    this.opts = { dir: "y", max: 100, min: 0, step: 1, scale: 1, axis: -1 };
    for(var key in opts) {
      if(!opts.hasOwnProperty(key)) continue;
      this.opts[key] = opts[key];
    }

    this._sizes = this._sizes();
    this._extraOffset = this._extraOffset();
    this._parent = jQuery(parent);
    this._init();
    this.scroll();
  };
  
  ScrollBar.prototype = {
    _extraOffset: function() {
      if(/AppleWebKit/.test(navigator.userAgent)) return { width: 0, height: 0 };
      return this._sizes;
    },

    _sizes: function() {
        var em = document.createElement("div");
        em.style.visibility = "hidden";

        document.body.appendChild(em);

        em.style.overflow = 'hidden';
        var w = em.clientWidth;
        var h = em.clientHeight;

        em.style.overflow = 'scroll';
        w -= em.clientWidth;
        h -= em.clientHeight;
        if(!w) w = em.offsetWidth - em.clientWidth;
        if(!h) h = em.offsetHeight - em.clientHeight;

        document.body.removeChild(em);
        return { width: Math.abs(h), height: Math.abs(h) };
    },
    
    _init: function() {
      this._init_em();
      this._init_css();
      this._filler.width(1).height(1);
      this._init_events();
      this.scroll();
    },
    
    _init_events: function() {
      var self = this;
      var evts = "mousewheel DOMMouseScroll";
      if(this.opts.delegate) {
        jQuery(this._parent).bind(evts, bind(this._onWheel, this));
      }
      jQuery(this._em).bind("scroll", bind(this._onScroll, this));
    },
    
    _onScroll: function() {
      if(this.opts.scroll) this.opts.scroll.call(this, this.value(), this._updateByCode);
    },
    
    _onWheel: function(e) {
      e.preventDefault();
      if(e.originalEvent.axis && this.opts.axis !== -1) {
        if(this.opts.axis !== e.originalEvent.axis) return;
      }
      else if(this.opts.axis == 1) return;

      e = e.originalEvent;
      var dir = this.scrollDirection();
      var dy = e.detail || 0;
      if(!dy) dy = -(e.deltaWheel/2);
      if(!dy) dy = -(e.wheelDelta/100);
      
      jQuery(this._em)[dir](jQuery(this._em)[dir]() + (dy * 10));
    },
    
    _init_em: function() {
      this._em = jQuery("<div>");
      this._filler = jQuery("<div>");
      this._coverCorner = jQuery("<div>").addClass("scroll-corner");

      this._em.addClass(this.direction() + "scroll")
      this._em.append(this._filler);
      this._parent.append(this._em);
      this._parent.append(this._coverCorner);
    },
    
    _addPadding: function(em, dir, value) {
      return;
      var current = Number(this._parent.css("padding-" + dir))||0;
      this._parent.css("padding-" + dir, value + current);
    },
    
    _init_css: function() {
      var self = this;
      var ofsX = this._extraOffset.width;
      var ofsY = this._extraOffset.height;

      if(this._parent.css("position") != "absolute") this._parent.css("position", "relative");
      if(this.direction() == "x") {
        this._em.css({ bottom: 0, left: 0, right: ofsX, height: this._sizes.height + 5 });
      } else {
        this._em.css({ bottom: ofsY, top: 0, right: 0, width: this._sizes.width + 5 });
      }
      if(ofsX&&ofsY) {
        this._coverCorner.css({ bottom: 0, right: 0, height: ofsY, width: ofsX, background: "#DDD", position: "absolute" });
      }
      this._em.css({ position: "absolute", overflow: "scroll" });
    },
    
    redraw: function() {
      var self = this;
      setTimeout(function() {
        self.scroll();
      }, 1);
    },
    
    maxValue: function() { return this.opts.currentMax || this.opts.max; },
    minValue: function() { return this.opts.currentMin || this.opts.min; },
    direction: function() { return this.opts.dir[0] == "y" ? "y" : "x"; },
    scrollDirection: function() { return this.direction() == "y" ? "scrollTop" : "scrollLeft"; },
    scrollDirectionMax: function() { return this.direction() == "y" ? "scrollHeight" : "scrollWidth"; },
    directionSize: function() { return this.direction() == "y" ? "height" : "width"; },
    outerDirectionSize: function() { return this.direction() == "y" ? "outerHeight" : "outerWidth"; },
    
    value: function() {
      var dir = this.scrollDirection();
      var plainValue = jQuery(this._em)[dir]() * (this.opts.step / 10);
      var maxValue = this._em[this.scrollDirectionMax()];
      var currentValue = plainValue / this.opts.scale;
      var offsetValue = currentValue % this.opts.step;
      return Math.max(this.minValue(), Math.min(this.maxValue(), this.opts.min + (currentValue - offsetValue) || 0));
    },
    
    scroll: function(value) {
      if(value) {
        try {
          this._updateByCode = true;
          var result = jQuery(this._em)[this.scrollDirection()](value * this.opts.step);
          return result;
        } finally {
          this._updateByCode = false;
        }
      }
      var dir = this.directionSize();
      var outer = this.outerDirectionSize();
      var span = this.opts.scale * ((this.maxValue() - this.minValue()) / (this.opts.step / 10)) + jQuery(this._parent)[outer]();
      this._filler[dir](span);
      this.currentValue = this.value()
    }
  };
  
  jQuery.fn.verticalScroll = function(opts) {
    if(!opts) opts = {};
    opts.dir = "y";

    var result = [];
    for(var i=0; i<this.length; ++i) {
      var em = jQuery(this[i]);
      if(em.data("verticalScroll")) continue;
      var instance = new ScrollBar(em, opts);
      em.data("verticalScroll", instance);
      result.push(instance);
    };
    return result.length == 1 ? result[0] : result;
  };
  
  jQuery.fn.horizontalScroll = function(opts) {
    if(!opts) opts = {};
    opts.dir = "x";
    
    var result = [];
    for(var i=0; i<this.length; ++i) {
      var em = jQuery(this[i]);
      if(em.data("horizontalScroll")) continue;
      var instance = new ScrollBar(em, opts);
      em.data("horizontalScroll", instance);
      result.push(instance);
    };
    return result.length == 1 ? result[0] : result;
  };
  
})(jQuery, window);

