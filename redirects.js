// Single source of truth: slug → its new home on a subdomain.
// Consumed by 404.html (legacy deep paths like /cuko/remote/ that 404) and by
// each <slug>/index.html stub (clean 200 at the bare /<slug> root). Add a line
// here + a <slug>/index.html stub to retire a path into its own subdomain.
// Preserves the remaining path + query + hash on the way out.
(function () {
  var MAP = {
    cuko:       "https://cuko.neves.cloud/",
    wires:      "https://wires.neves.cloud/",
    canvasflow: "https://canvasflow.neves.cloud/",
  };
  var m = location.pathname.match(/^\/([^\/]+)(?:\/(.*))?$/);
  var base = m && MAP[m[1]];
  if (base) location.replace(base + (m[2] || "") + location.search + location.hash);
})();
