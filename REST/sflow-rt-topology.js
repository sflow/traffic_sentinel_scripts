// author: Neil McKee
// description: export map to sFlow-RT topology format
// date: 9/23/2026
// version: 1.0
// ttl: 60
// inputs: zone,debug,allports
// resultFormat: json
// authClients: 127.0.0.1

var allports = allports || "false";
var zone = zone || null;
var debug = debug || 0;

debug = parseInt(debug);
var scopePath = null;
if(zone) scopePath = ">>"+ zone;

var performance=[];
function now_ms() { return (new Date).getTime(); }
var tcursor=now_ms();
function checkpoint(step) {
    var now = now_ms();
    performance.push("" + (now - tcursor));
    performance.push("starting: " + step);
    tcursor = now;
}
checkpoint("start");

// sFlow-RT expects topology in this form:
// {
// nodes: { 
//   "nodename1": {
//      "agent":  10.1.2.3,
//      "ports": {
//         "portname1": {
//            "ifIndex": 7,
//         }
//      }
//    }
//  }
//  "links": {
//     "linkname1": {
//       "node1": "nodename1",
//       "node2:  "nodename2",
//       "port1":  "portname1",
//       "port2:   "portname2"
//     }
//  }
//}

var n = Network.current();
var nodes = {};

function getAgentName(agent) {
    n.path = agent;
    return n.displayName();
}

function getPortName(intf) {
    n.path = intf;
    if(intf == ">0") return "undefined";
    // The ifName is the most stable, if we can get it
    var ans = n.ifName();
    if(!ans) ans = n.ifDescr();
    if(!ans) ans = n.displayName();
    if(!ans) {
	ans = intf;
	if(debug > 1) println("getPortName(" + intf + ") - lookup failed");
    }
    // at least one vendor has a strange mismatch
    // where they report "ethnernet1/1" in one
    // place and "eth1/1" in another, so normalize
    // here:
    ans = ans.replace("ethernet", "eth");
    return ans;
}

function getNode(ip) {
    if(!nodes[ip]) {
	nodes[ip] = {
	    "agent": ip,
	    "name": getAgentName(ip),
	    "ports": {}
	}
    }
    return nodes[ip];
}

function getPort(node, intf) {
    if(!node.ports[intf]) {
	n.path = intf;
	node.ports[intf] = {
	    "ifindex": n.ifIndex(),
	    "name": getPortName(intf),
	    "node": node
	}
    }
    return node.ports[intf];
}

// a "linkSet" here is a set of links between a pair of nodes
var linkSets = {};
var linkedPorts = {};

function getLinkSet(n1, n2) {
    var lsid = n1.name + " - " + n2.name;
    if(!linkSets[lsid]) linkSets[lsid] = {
	"lsid":lsid,
	"node1": n1,
	"node2": n2,
	"links": {},
	"nlinks": 0
    };
    return linkSets[lsid];
}

function getLink(lset, p1, p2) {
    var lid = p1.node.name + " - " + p2.node.name + " - " + (lset.nlinks + 1);
    if(!lset.links[lid]) {
	lset.links[lid] = {
	    "lid": lid,
	    "port1": p1,
	    "port2": p2
	};
	lset.nlinks++;
    }
    return lset.links[lid];
}

checkpoint("get allinterfaces and neighbors");

n.path = scopePath;
var allinterfaces = n.interfaces();
if(allinterfaces) {
    var neighbors = n.neighborMap(allinterfaces);

    checkpoint("iterate over interfaces");
    for (var ii in allinterfaces) {
	var intf = allinterfaces[ii];
	var neighbor = neighbors[ii];

	if(!neighbor && allports == "false") continue;

	n.path = intf;
	if(n.isHost()) continue;
	var node1 = getNode(n.agentIP());
	var port1 = getPort(node1, intf);

	if(!neighbor) continue;

	var node2 = null;
	var port2 = null;

	if(neighbor == ">0") {
	    // partially specified
	    linkedPorts[intf] = { "node": node1, "port": port1 };
	}
	else {
	    n.path = neighbor;
	    if(n.isHost()) continue;
	    node2 = getNode(n.agentIP());
	    port2 = getPort(node2, neighbor);

	    var n1 = node1;
	    var n2 = node2;
	    var p1 = port1;
	    var p2 = port2;
	    if(node1 > node2) {
		// flip to normalize
		n1 = node2;
		n2 = node1;
		p1 = port2;
		p2 = port1;
	    }
	    var lset = getLinkSet(n1, n2);
	    getLink(lset, p1, p2);
	}
    }
    
    
    // now build the final "links" collection, adding a suffix
    // when there are multiple links in a linkSet
    var links = {};
    checkpoint("extract links");
    
    for each (var lset in linkSets) {
	var linkArray = [];
	for each (var lnk in lset.links) linkArray.push(lnk);
	linkArray.sort(function(a,b) { return (a.lid > b.lid);});
	for(var ii in linkArray) {
	    var lnk = linkArray[ii];
	    links[lnk.lid + "/" + lset.nlinks] = {
		"node1": lset.node1.name,
		"node2": lset.node2.name,
		"port1": lnk.port1.name,
		"port2": lnk.port2.name
	    }
	}
    }
    for(var intf in linkedPorts) {
	var lp = linkedPorts[intf];
	var linkID = lp.node.name + "." + lp.port.name;
	links[linkID] = {
	    "node1": lp.node.name,
	    "port1": lp.port.name,
	}
    }
}

// convert the nodes and their ports to tables keyed by name
checkpoint("nodes by name");
var nodesByName = {};
for each (var node in nodes) {
    var portsByName = {}
    for each(var port in node.ports) {
	portsByName[port.name] = { "ifindex":port.ifindex };
    }
    nodesByName[node.name] = { "agent": node.agent, ports: portsByName }
}

var topology = {};
topology.nodes = nodesByName;
topology.links = links;
checkpoint("print JSON");
var out = JSON.stringify(topology, null, 2);
checkpoint("done");
if(debug > 0) {
    println(JSON.stringify(performance, null, 2));
}
println(out);
