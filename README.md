# OpenShift UPI Config Generator

A **browser-based GUI** tool to generate **full OpenShift UPI configuration files** for multi-master and multi-worker clusters.  

Generates the following files dynamically:

- `install-config.yaml`  
- `named.conf`  
- `forward-zone`  
- `reverse-zone`  
- `haproxy.cfg`  

All files are **customized based on user inputs** like cluster name, base domain, DNS/LB IP, bootstrap/master/worker IPs, pull secret, and SSH key.
<p align="center">
  <img src="https://raw.githubusercontent.com/abidkhancu/openshift-upi-configs-generator/refs/heads/main/ss.png" width="700">
</p>



## Features

- Multi-master & multi-worker support  
- Auto-generate forward and reverse DNS zones  
- Full HAProxy configuration for API, MCS, HTTP, HTTPS  
- No backend required – runs entirely in the browser  
- Download all files instantly  
- GitHub Pages compatible  

## Usage
https://abidkhancu.github.io/openshift-upi-configs-generator/

*OR*
1. Clone or download the repository.  
2. Open `index.html` in your browser.  
3. Fill in cluster information, IPs, node counts, pull secret, and SSH key.  
4. Click **Generate & Download All**.  
5. Files are downloaded automatically.  

