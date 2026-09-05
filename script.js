const discordButton = document.getElementById("discordButton");

discordButton.addEventListener("click", () => {
discordButton.disabled = true;

```
discordButton.textContent = "Connecting to Discord...";

window.location.href = "/auth/discord";
```

});
