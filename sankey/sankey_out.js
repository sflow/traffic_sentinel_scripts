// description: Outbound Traffic
// author: InMon
// date: 5/15/2022
// version: 1.0
// clientJS:sankey-2.0.js
// ttl:60
// view:traffic
// resultFormat: json
// authLevel: operator

include('sankey-2.0.js');

new Sankey({
    height: 800,
    layers: [
'sourcegroup',
'sourcezone',
'or(name(serverport),str(serverport))',
'or(domain(destinationname,2),"other")',
'or(name(asn(destinationaddress)),"other")',
'destinationcountry' // 'or(destinationcountry,"other")'
],
    labels: [null, null, "Service", "DNS", "AS", "Country"],
    selectedLayer: 2,
    value: "bps",
    interval: "last5minutes",
    colors: '#000000,#db3a34,#f0c808,#56926e,#6c4f77,#4281a4',
    refresh: true,
    debug: false
}).printResult();

