(function () {
  "use strict";

  var statusElement = document.getElementById("mediator-application-status");
  var linkElement = document.getElementById("mediator-application-link");
  if (!statusElement || !linkElement) return;

  function setState(isOpen) {
    statusElement.classList.toggle("is-open", isOpen);
    statusElement.classList.toggle("is-closed", !isOpen);
    statusElement.textContent = isOpen ? "التقديم مفتوح" : "التقديم مغلق";
    linkElement.setAttribute("aria-disabled", isOpen ? "false" : "true");
    linkElement.title = isOpen ? "ابدأ التقديم" : "التقديم مغلق حالياً";
  }

  fetch("/api/mediator/config", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  })
    .then(function (response) {
      if (!response.ok) throw new Error("config_unavailable");
      return response.json();
    })
    .then(function (config) {
      setState(Boolean(config && config.isOpen));
    })
    .catch(function () {
      setState(false);
    });
})();
