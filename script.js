const discordButton = document.getElementById("discordButton");

if (discordButton) {
discordButton.addEventListener("click", () => {
discordButton.disabled = true;
discordButton.textContent = "Connecting to Discord...";


    window.location.href =
        "https://botzen-r4do.onrender.com/auth/discord";
});


}
