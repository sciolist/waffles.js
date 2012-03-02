require "fileutils"
require "json"

task :default => [:"build:browser"] do
end

desc "Builds a javascript file for inclusion in web browsers."
task :"build:browser" do
  pkg = File.open "package.json" do |f|
    JSON.parse f.read
  end

  template = <<-CODE
requireCode["./%s"] = function(exports) {
  %s
};
CODE

  results = Dir["./lib/*"].map do |file|
    data = File.read(file).gsub /\n/, "\n  "
    name = File.basename(file, ".js")
    template % [name, data]
  end

  FileUtils.mkdir "./out" unless Dir.exist? "./out"
  File.open "./out/waffles.js", "w" do |f|
    f.puts <<-CODE
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
#{results.join ""}
window.Waffles = require('./#{File.basename(pkg["main"], '.js')}')
window.Waffles.require = require;
})(window);

CODE
  end
end

desc "Run the test suite."
task :test do |t|
  sh "node", "tests/runner.js", Dir["tests/**/test.*.js"].join(" ")
end


