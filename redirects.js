// Single source of truth: slug → its new home (a subdomain, or a path on
// another domain). Consumed by 404.html (legacy deep paths like /cuko/remote/
// that 404) and by each <slug>/index.html stub (clean 200 at the bare /<slug>
// root). Add a line here + a <slug>/index.html stub to retire a path.
// Preserves the remaining path + query + hash on the way out — so every target
// needs its trailing slash, or subpaths (and only subpaths) break.
(function () {
  var MAP = {
    cuko:       "https://jonasneves.com/cuko/",
    wires:      "https://jonasneves.com/wires/",
    // The extension renamed CanvasFlow -> Kandue 2026-09-05, moving its project
    // site with it. Load-bearing for installs, not just links: every build up to
    // 1.8.1 hard-codes /canvasflow/uninstall.html as its setUninstallURL, and
    // that only moves when an install auto-updates.
    canvasflow: "https://neves.cloud/kandue/",
  };
  var m = location.pathname.match(/^\/([^\/]+)(?:\/(.*))?$/);
  var base = m && MAP[m[1]];
  if (base) location.replace(base + (m[2] || "") + location.search + location.hash);
})();
