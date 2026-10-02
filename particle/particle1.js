// description: Particle Visualization (IPv4)
// author: InMon
// date: 8/2/2018
// version: 1.0
// authLevel:operator
// clientJS:flow-1.0.js
// ttl:60
// view:traffic
// resultFormat: json

include('flow-1.0.js');

new Flow({
  title: 'Traffic IPv4',
  N:{zones:['EXTERNAL'],label:'External'},
  S:{zones:['DMZ'],label:'DMZ'},
  E:{zones:['WiFi'],label:'WiFi'},
  W:{zones:['Demos','Unassigned'],label:'Demos/RFC1918'},
  ipv6:false,
  links:true,
  interval:'last5minutes'
}).printResult();
