(function () {
  var form = document.querySelector(".owner-compose-form");
  if (!form) return;
  var ta = form.querySelector('textarea[name="body"]');
  if (!ta) return;

  form.querySelectorAll(".emoji-bar button[data-emoji]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var em = btn.getAttribute("data-emoji");
      if (!em) return;
      var start = ta.selectionStart;
      var end = ta.selectionEnd;
      var before = ta.value.slice(0, start);
      var after = ta.value.slice(end);
      ta.value = before + em + after;
      ta.selectionStart = ta.selectionEnd = start + em.length;
      ta.focus();
    });
  });

  var box = document.getElementById("owner-chat-messages");
  if (box) box.scrollTop = box.scrollHeight;
})();
