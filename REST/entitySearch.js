// author: Neil McKee
// date: 9/24/26
// version: 1.1
// ttl: 60
// resultFormat: html
// authLevel: operator
// inputs: zone,group,agent,match,serial,swrev,cls

var zone = zone || null;
var group = group || null;
var agent = agent || null;
var match = match || "";
var serial = serial || ".*"; // note: this selects rows with non-empty serial number
var swrev = swrev || "";
var cls = cls || "";

var matchRE = match ? new RegExp(match) : null;
var serialRE = serial ? new RegExp(serial) : null;
var swrevRE = swrev ? new RegExp(swrev) : null;
var clsRE = cls ? new RegExp(cls) : null;

function rowMatch(row, re) {
    if(re == null)
	return true;
    for each (var obj in row) {
	if(obj && re.test(obj))
	    return true;
    }
    return false;
}

function colMatch(row, re, col) {
    return (re == null
            || (row[col]
		&& re.test(row[col])));
}

var classToName = [null,
		   "other",
		   "unknown",
		   "chassis",
		   "backplane",
		   "container",
		   "powerSupply",
		   "fan",
		   "sensor",
		   "module",
		   "port",
		   "stack"];

var filtered = null;
var clsCol = 0;
var serialCol = 0;
var swrevCol = 0;

var path = null;
// setting agent overrides zone and group,
// and group only applies if zone is set too.
if(agent)
    path = agent;
else if (zone) {
    path = ">>" + zone;
    if(group)
	path = ">>" + zone + ">" + group;
}
var n = Network.current();
n.path = path;
for each (var ag in n.agents()) {
    n.path = ag;
    var tab = n.snmpTable("entity2");
    if(tab) {
	if(!filtered) {
	    clsCol = tab.cnames.indexOf("physClass");
	    serialCol = tab.cnames.indexOf("serialNo");
	    swrevCol = tab.cnames.indexOf("swrev");
	    filtered = Table.create(tab.cnames, tab.ctypes);
	    filtered.insertColumn("agent","string", [], 0);
	}
	for(var rr = 0; rr < tab.nrows; rr++) {
	    var row = tab.row(rr);
	    // replace phyClass with class name before applying regex
	    if(clsCol)
		row[clsCol] = classToName[row[clsCol]];
	    if(colMatch(row, serialRE, serialCol)
               && colMatch(row, swrevRE, swrevCol)
         && colMatch(row, clsRE, clsCol)
               && rowMatch(row, matchRE)) {
		row.unshift('<a href="/inmsf/Go?action=agent&go='+ ag +'">' + n.displayName() + '</a>');
		filtered.addRow(row);
	    }
	}
    }
}

println("<html>");
println("<head>");
println('<link rel="stylesheet" type="text/css" href="/inmsf/inc/inmsf/main.css" media="all" />');
println('<style>#content .stripe tbody tr td a:link {text-decoration:underline; color:#0000FF;}</style>');
println('<style>#content .stripe tbody tr td a:visited {text-decoration:underline; color:#FF0000;}</style>');
println('<script type="text/javascript" src="/inmsf/inc/jquery.min.js"></script>');
println('<script type="text/javascript">');
println(`$(document).ready(function() {
  function filterList(str) {
    $('table tbody tr').each(function() {
      var text = $(this).text().toLowerCase();
      $(this).toggle(text.indexOf(str) > -1);
    });
  };
  $('#search-box').on('input', function() {
      filterList($(this).val().toLowerCase());
  });
});`);
println('</script>');
println("</head>");
println("<body>");
println('<div id="content">');

println(`<div id="top-panel">
      <label for="search-box">Search</label>
      <input type="search" size="30" id="search-box"></input>
</div>`);

if(filtered == null) {
    println("<p>no data</p>");
    println("<p>(path=" + path + ", match=" + match + ", serial=" + serial + ", swrev=" + swrev + ", cls=" + cls + ")</p>");
}
else {
    filtered.printHTML(true);
}

println("</div>");
println("</body>");
println("</html>");
