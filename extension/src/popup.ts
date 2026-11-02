// Toolbar launcher: opens the club in its own tab. (Finding an already-open tab would need the
// broad "tabs" permission, which isn't worth the scarier install warning.)
document.getElementById("open")!.addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  window.close();
});
