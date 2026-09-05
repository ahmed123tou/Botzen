const discordButton =
document.getElementById("discordButton");

const signupButton =
document.getElementById("signupButton");

const backButton =
document.getElementById("backButton");

const loginScreen =
document.getElementById("loginScreen");

const signupScreen =
document.getElementById("signupScreen");

const signupForm =
document.getElementById("signupForm");

const signupMessage =
document.getElementById("signupMessage");

const passwordInput =
document.getElementById("password");

const passwordToggle =
document.getElementById("passwordToggle");

/* =========================
BOTZEN BACKEND
========================= */

const BOTZEN_BACKEND =
"https://botzen-r4do.onrender.com";

/* =========================
DISCORD LOGIN
========================= */

if (discordButton) {


discordButton.addEventListener("click", function () {

    discordButton.disabled = true;

    discordButton.textContent =
        "Connecting to Discord...";

    const clientId =
        "1545716437987893308";

    const redirectUri =
        BOTZEN_BACKEND + "/callback";

    const discordOAuth =
        "https://discord.com/oauth2/authorize" +
        "?client_id=" +
        encodeURIComponent(clientId) +
        "&response_type=code" +
        "&redirect_uri=" +
        encodeURIComponent(redirectUri) +
        "&scope=identify";

    window.location.href =
        discordOAuth;
});


}

/* =========================
OPEN SIGNUP
========================= */

if (signupButton) {


signupButton.addEventListener("click", function () {

    loginScreen.style.display =
        "none";

    signupScreen.style.display =
        "block";

    document.title =
        "Botzen — Create Account";
});


}

/* =========================
BACK TO LOGIN
========================= */

if (backButton) {


backButton.addEventListener("click", function () {

    signupScreen.style.display =
        "none";

    loginScreen.style.display =
        "block";

    document.title =
        "Botzen — Sign Up";

    signupMessage.textContent =
        "";
});


}

/* =========================
SHOW / HIDE PASSWORD
========================= */

if (passwordToggle && passwordInput) {


passwordToggle.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type =
            "text";

        passwordToggle.textContent =
            "Hide";

    } else {

        passwordInput.type =
            "password";

        passwordToggle.textContent =
            "Show";
    }
});


}

/* =========================
SIGNUP FORM
========================= */

if (signupForm) {


signupForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const username =
        document.getElementById("username")
            .value
            .trim();

    const password =
        passwordInput.value;


    if (username.length < 3) {

        signupMessage.textContent =
            "Username must be at least 3 characters.";

        return;
    }


    if (password.length < 6) {

        signupMessage.textContent =
            "Password must be at least 6 characters.";

        return;
    }


    signupMessage.textContent =
        "Account created! Opening Botzen...";


    /*
        The frontend is hosted on GitHub Pages,
        so /dashboard.html would incorrectly
        point to GitHub Pages.

        Send the user directly to Render instead.
    */

    setTimeout(function () {

        window.location.href =
            BOTZEN_BACKEND + "/dashboard.html";

    }, 500);
});


}
