// description: DNS Map
// author: nhm
// date: 1/8/24
// version: 0.91
// ttl: 60
// clientJS:map-2.0.js
// resultFormat: json
// inputs: interval,domain,where,n,hot
// authLevel: operator

// input defaults
var interval = interval || "last5minutes";
var domain = domain || "";
var where = where || "";
var n = n || 20;
var hot = hot || 1e9;

include('map-2.0.js');

var value = 'rate(scale(bytes,8))';
var rootcolor = 'YELLOW';
var domaincolor = "LIGHT_GREEN";
var domainshape = "round_rectangle";
var dotName = "ROOT";

map = new Map({ layout: "hierarchic left-to-right",
                minNodeDistance: 40,
                refresh: true,
                refreshLayout: true,
                directional: true,
		height: 1000
	      });

map.setNodeDefaults({ gradient: true, shadow: true });

function filterAND(filter, expr) {
    if(expr && filter)
	return '(' + filter + ')&(' + expr + ')';
    return expr || filter;
}

function buildURL(ival, dom, wh, tr, ht) {
    return "./Q/" + queryPath() + "?interval="+encodeURIComponent(ival)
	+ "&domain=" + encodeURIComponent(dom)
	+ "&where=" +  encodeURIComponent(wh)
	+ "&n=" + encodeURIComponent(tr)
	+ "&hot=" + encodeURIComponent(ht);
}

var select = 'substr(destinationname,".",1,10),' + value;

var srcFilter = where;
var dstFilter = where;
if(domain && domain !== dotName) {
    srcFilter = filterAND(srcFilter, 'sourcename~' + domain);
    dstFilter = filterAND(dstFilter, 'destinationname~' + domain);
}

var filter = [srcFilter, dstFilter];
var select = ['substr(sourcename,".",1,10),' + value,
              'substr(destinationname,".",1,10),' + value];

var q = Query.topN("traffic",
                   select,
                   filter,
                   interval,
                   value,
                   n);
q.multiquery = true;

function addDomain(dom,rootFlag) {
    var drilldown = rootFlag ? "" : ("-" + dom);
    map.addNode(dom, {
        domain: dom,
        color: (rootFlag ? rootcolor : domaincolor),
	shape: domainshape,
	evtId: 'domain',
	url: buildURL(interval, dom, where, n, hot)
    });
}

function addEdge(n1,n2,weight,rootFlag) {
    var eid = n1 + "-" + n2;
    var drilldown = rootFlag ? ("-" + n2) : ("-" + eid);
    var ed = map.addEdge(eid, n1, n2, {
	arrow: 1,
	evtId: 'asLink',
	url: buildURL(interval, n1, where, n, hot)
    });
    ed.value += weight;
}

// run the query and build the map

var tab = q.run(function(row) {
  var [nm, val] = row;
  if(nm) {
    prev = "";
    components = nm.split(".");
    components.push(dotName);
    for each (var dom in components) {
      addDomain(dom, (dom===dotName));
      if(prev)
        addEdge(prev, dom, val, (prev===""));
      prev = dom;
    }
  }
});


// color the edges with a heatmap, calibrated by value of "hot"
var myHeatMap = Edge.HEATMAP(0, hot);
for each (var ed in map.edges) {
  ed.color = myHeatMap(ed.value);
}

// label edges with traffic in Mbps, to appear when zooming in
Edge.LABEL_BY_VALUE = function(map) {
    for each (var ed in map.edges) {
	mbps = ed.value / 1e6;
	ed.addLabel(formatnumber(mbps, "0.0") + " Mbps", {
	    position: "TC", // Target-Center
	    zoomLevel: 1.0
	});
    }
}

// scale edge width by (relative) value
map.edgeWidthPolicy = Edge.WIDTH_BY_VALUE;
// invoke edge labeling
map.edgeLabelPolicy = Edge.LABEL_BY_VALUE;
// make busy nodes bigger
map.nodeValuePolicy = Node.VALUE_BY_EDGE_VALUE_SUM;
map.nodeSizePolicy = Node.AREA_BY_VALUE;
// send graph to client for rendering
map.printResult();
