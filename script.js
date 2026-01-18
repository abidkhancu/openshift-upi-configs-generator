function buildNodeInputs() {
  const masters = document.getElementById("masters").value;
  const workers = document.getElementById("workers").value;
  const div = document.getElementById("nodes");
  div.innerHTML = "";

  for (let i = 0; i < masters; i++) {
    div.innerHTML += `<input placeholder="Master-${i} IP" id="m${i}">`;
  }
  for (let i = 0; i < workers; i++) {
    div.innerHTML += `<input placeholder="Worker-${i} IP" id="w${i}">`;
  }
}

function generateConfigs() {
  const get = id => document.getElementById(id).value;

  const cluster = get("cluster");
  const domain = get("domain");
  const svc = get("svc");
  const lb = get("lb");
  const subnet = get("subnet");
  const bootstrap = get("bootstrap");
  const masters = +get("masters");
  const workers = +get("workers");
  const pull = get("pull");
  const ssh = get("ssh");

  let masterIPs=[], workerIPs=[];
  for(let i=0;i<masters;i++) masterIPs.push(get("m"+i));
  for(let i=0;i<workers;i++) workerIPs.push(get("w"+i));

  // --- install-config.yaml ---
  const install = `apiVersion: v1
baseDomain: ${domain}
metadata:
  name: ${cluster}
controlPlane:
  hyperthreading: Enabled
  name: master
  replicas: ${masters}
compute:
- hyperthreading: Enabled
  name: worker
  replicas: 0
platform:
  none: {}
fips: false
networking:
  clusterNetwork:
  - cidr: 10.128.0.0/14
    hostPrefix: 23
  networkType: OVNKubernetes
  serviceNetwork:
  - 172.30.0.0/16
pullSecret: '${pull}'
sshKey: "${ssh}"
`;

  // --- named.conf ---
  const named = `options {
    listen-on port 53 { 127.0.0.1; ${lb}; };
    directory "/var/named";
    dump-file "/var/named/data/cache_dump.db";
    statistics-file "/var/named/data/named_stats.txt";
    memstatistics-file "/var/named/data/named_mem_stats.txt";
    recursion yes;
    allow-query { localhost; any; };
    forwarders { 8.8.8.8; 8.8.4.4; };
};

zone "${domain}" {
    type master;
    file "/var/named/forward-zone";
};

zone "${subnet.split(".").reverse().join(".")}.in-addr.arpa" {
    type master;
    file "/var/named/reverse-zone";
};
`;

  // --- forward-zone ---
  let forward = `$TTL 86400
@ IN SOA ${svc}.${domain}. contact.${domain}. (
  2026011301 3600 1800 604800 86400
)
@ IN NS ${svc}.${domain}.
${svc}.${domain}. IN A ${lb}
ocp-bootstrap.${cluster}.${domain}. IN A ${bootstrap}
`;

  masterIPs.forEach((ip,i)=>{
    forward+=`ocp-master-${i}.${cluster}.${domain}. IN A ${ip}
etcd-${i}.${cluster}.${domain}. IN A ${ip}
`;
  });

  workerIPs.forEach((ip,i)=>{
    forward+=`ocp-worker-${i}.${cluster}.${domain}. IN A ${ip}\n`;
  });

  forward+=`
api.${cluster}.${domain}. IN A ${lb}
api-int.${cluster}.${domain}. IN A ${lb}
*.apps.${cluster}.${domain}. IN A ${lb}
`;

  masterIPs.forEach((ip,i)=>{
    forward+=`_etcd-server-ssl._tcp.${cluster}.${domain}. IN SRV 0 10 2380 etcd-${i}.${cluster}.${domain}.\n`;
  });

  // --- reverse-zone ---
  let reverse = `$TTL 604800
@ IN SOA ${svc}.${domain}. contact.${domain}. (
  1 604800 86400 2419200 604800
)
IN NS ${svc}.${domain}.
`;

  [lb, bootstrap,...masterIPs,...workerIPs].forEach(ip=>{
    const last = ip.split(".")[3];
    reverse+=`${last} IN PTR ${cluster}.${domain}.\n`;
  });

  // --- haproxy.cfg ---
  let haproxy = `global
  maxconn 20000
  log /dev/log local0 info
  daemon

defaults
  log global
  retries 3
  timeout connect 40000ms
  timeout client 300000ms
  timeout server 300000ms
  timeout queue 50000ms

listen stats
  bind :9000
  stats uri /stats
  mode http

frontend k8s_api_frontend
  bind :6443
  mode tcp
  default_backend k8s_api_backend

backend k8s_api_backend
  mode tcp
  balance source
  server bootstrap ${bootstrap}:6443 check
`;

  masterIPs.forEach(ip=> haproxy+=`  server master ${ip}:6443 check\n`);

  haproxy+=`
frontend ocp_machine_config_server_frontend
  bind :22623
  mode tcp
  default_backend ocp_machine_config_server_backend

backend ocp_machine_config_server_backend
  mode tcp
  balance source
  server bootstrap ${bootstrap}:22623 check
`;

  masterIPs.forEach(ip=> haproxy+=`  server master ${ip}:22623 check\n`);

  haproxy+=`
frontend ocp_http_ingress_frontend
  bind :80
  mode tcp
  default_backend ocp_http_ingress_backend

backend ocp_http_ingress_backend
  mode tcp
  balance source
`;

  [bootstrap,...masterIPs,...workerIPs].forEach(ip=> haproxy+=`  server node ${ip}:80 check\n`);

  haproxy+=`
frontend ocp_https_ingress_frontend
  bind :443
  mode tcp
  default_backend ocp_https_ingress_backend

backend ocp_https_ingress_backend
  mode tcp
  balance source
`;

  [bootstrap,...masterIPs,...workerIPs].forEach(ip=> haproxy+=`  server node ${ip}:443 check\n`);

  // Download all
  download("install-config.yaml",install);
  download("named.conf",named);
  download("forward-zone",forward);
  download("reverse-zone",reverse);
  download("haproxy.cfg",haproxy);
}

function download(name, content){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([content],{type:"text/plain"}));
  a.download=name;
  a.click();
}
