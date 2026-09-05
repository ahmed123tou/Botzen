const discordButton = document.getElementById("discordButton");

if (discordButton) {
discordButton.addEventListener("click", function () {
discordButton.disabled = true;
discordButton.textContent = "Connecting to Discord...";


    const clientId = "1545716437987893308";
    const redirectUri =
        "https://botzen-r4do.onrender.com/callback";

    const discordOAuth =
        "https://discord.com/oauth2/authorize" +
        "?client_id=" + encodeURIComponent(clientId) +
        "&response_type=code" +
        "&redirect_uri=" + encodeURIComponent(redirectUri) +
        "&scope=identify";

    window.location.href = discordOAuth;
});


}
