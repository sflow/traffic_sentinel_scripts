// description: Optical Port dashboard v3, URL parameters are agent,port,interval,N
// author: InMon
// date: 10/25/2024
// version: 1.1
// authLevel:operator
// clientJS:dashboard-2.0.js
// ttl: 60
// resultFormat: json
// inputs: agent,port,interval,N

// Copy this REST script to create new dashboards
// See http://www.inmon.com/tutorials8/dashboard.php

include('dashboard-2.0.js');

// inputs
var agent = agent || "";
var port = port || "";
var N = N || "5";
var interval = interval || "now - 8 hours, last";

var pathFilter = "";
var titleSuffix = " ";

if(!agent || !port)
  throw("agent and port parameters are required");

// look up in network state in case we got names instead of numbers
var net = Network.current();
net.path = agent + ">" + port;
var agentIP = net.agentIP();
var ifIndex = net.ifIndex();

if(!agentIP)
  throw("agent lookup failed: " + agent);
if(!ifIndex)
  throw("port lookup failed: " + port);

titleSuffix += net.agent() + ">" + net.ifName();

function addFilter(filter, add) {
  if(filter && add)
    return "( " + filter + " ) & ( " + add + " )";
  else
    return filter || add;
}

var filter = "agent=" + agentIP;
filter = addFilter(filter, "mod_lane_index != null");
filter = addFilter(filter, "ifindex = " + ifIndex);

function lane_field(metric, lane_index) {
  var lane_set = Math.floor(lane_index / 4) + 1;
  var lane_idx = lane_index % 4;
  return metric + "_" + lane_set + "." + lane_idx;
}

function lane_fields_for_metric(metric, lanes) {
  var fields = [];
  for(var lane = 0; lane < lanes; lane++)
    fields.push(lane_field(metric, lane));
  return fields;
}

var view = "ifcounters";

// start by learning the number of lanes, and the latest temp, voltage
// and the lookup from lane-index to column (for max of 8)
// (have to look over last 15 minutes so that it still works after a restart)
var lanes = 0;
var query = Query.topN(view, "max(mod_lanes),max(mod_temperature),max(mod_voltage)," + lane_fields_for_metric("mod_lane_index", 8), filter, "last15minutes");
query.nullsinkeys = true;
tab = query.run();
lanes = tab.cell(0, 0) || 1; // if anything went wrong with the query then we'll just go with lanes == 1
mtemp = tab.cell(0, 1) || 0;
mvolt = tab.cell(0, 2) || 0;
var lane_index = [];
var lane_legend = [];
for(var ll=0; ll<lanes; ll++) {
  var laneNo = tab.cell(0, 3 + ll);
  lane_index.push(laneNo);
  lane_legend.push("lane-" + laneNo);
}

if(mtemp)
  titleSuffix += " " + mtemp + " oC";
if(mvolt)
  titleSuffix += " " + mvolt + " V";


/////////// helper function to collect trend specs ///////////

var specs = [];
function addLanesCtrTrend(title, metric, scale, yLab, where) {
  var values = lane_fields_for_metric(metric, lanes);
  specs.push({
    title: title + titleSuffix,
    view: view,
    select:'time,' + values,
    scale: scale,
    ylabel: yLab,
    type: 'trend',
    where: where,
    stack: false,
    legendHeadings: lane_legend
  });
}


function uW_to_dBm(uW) { return (10 * Math.log10(uW * 1000.0)); }

addLanesCtrTrend('Receive Power', "mod_rx_power", uW_to_dBm, 'dBm', filter);
addLanesCtrTrend('Transmit Power', "mod_tx_power", uW_to_dBm, 'dBm', filter);
addLanesCtrTrend('Transmit Bias Current',"mod_tx_bias_current", 1000000, 'uA', filter);

// see if we can add charts for the other end of the link
var nbrMap = net.neighborMap([ agentIP + ">" + ifIndex ]);
if(nbrMap
   && nbrMap[0]) {
  net.path = nbrMap[0];
  var filter2 = "agent=" + net.agentIP();
  filter2 = addFilter(filter2, "mod_lane_index != null");
  filter2 = addFilter(filter2, "ifindex = " + net.ifIndex());
  titleSuffix = " neighbor: " + net.agent() + ">" + net.ifName();
  addLanesCtrTrend('Remote Receive Power', "mod_rx_power", uW_to_dBm, 'dBm', filter2);
  addLanesCtrTrend('Remote Transmit Power', "mod_tx_power", uW_to_dBm, 'dBm', filter2);
  addLanesCtrTrend('Remote TX Bias Current',"mod_tx_bias_current", 1000000, 'uA', filter2);
  // and arrange so they match up rx-tx and tx-rx
  var trends = new Trends({chartHeight: 220, chartWidth: 700, step: false, columns: 2, interval: interval });
  trends.addTrend(specs[0]);
  trends.addTrend(specs[4]);
  trends.addTrend(specs[1]);
  trends.addTrend(specs[3]);
  trends.addTrend(specs[2]);
  trends.addTrend(specs[5]);
}
else {
  var trends = new Trends({chartHeight: 220, chartWidth: 900, step: false, columns: 1, interval: interval });
  trends.addTrend(specs[0]);
  trends.addTrend(specs[1]);
  trends.addTrend(specs[2]);
}

trends.printResult();

