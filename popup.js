const status = document.getElementById("status");

document.getElementById("run").addEventListener("click", () => {
  status.textContent = "Processando...";
  chrome.runtime.sendMessage({ action: "run-autofill-native" }, () => {
    status.textContent = "Feito! Painel atualizado.";
    setTimeout(() => window.close(), 800);
  });
});

document.getElementById("panel").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "open-panel" }, () => {
    window.close();
  });
});