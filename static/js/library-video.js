(function () {
  var local = document.getElementById("local-player");
  var hash = window.location.hash.match(/#t=(\d+)/);
  var startAt = hash ? parseInt(hash[1], 10) : 0;

  function seekTo(seconds) {
    if (local) {
      local.currentTime = seconds;
      local.play();
      local.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var iframe = document.getElementById("yt-player");
    if (iframe) {
      var base = iframe.src.split("?")[0];
      iframe.src = base + "?start=" + seconds + "&autoplay=1&enablejsapi=1&rel=0";
      iframe.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (startAt > 0) {
    if (local) {
      local.addEventListener("loadedmetadata", function () {
        seekTo(startAt);
      });
    } else {
      seekTo(startAt);
    }
  }

  document.querySelectorAll(".segment-row").forEach(function (btn) {
    btn.addEventListener("click", function () {
      seekTo(parseInt(btn.getAttribute("data-seek"), 10) || 0);
    });
  });
})();
