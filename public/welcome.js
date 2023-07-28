// public/welcome.js

class WelcomeScreen {
    constructor() {
      this.$welcomeScreen = document.querySelector(".welcome-screen");
      this.$loginBtn = this.$welcomeScreen.querySelector("button");
      this.$input = this.$welcomeScreen.querySelector("input");

      this.initializeListeners();
    }

    initializeListeners(){
        // add event listeners for both click and enter events
        this.$loginBtn.addEventListener("click", ()=>{
            this.connectUser();
        });
        this.$input.addEventListener("keypress", (e)=>{
            if (e.key == "Enter"){
                this.connectUser();
            }
        });
    }

    connectUser(){
        if (this.$input.value === ''){
            return;
        }

        const currentUser = {
            name: this.$input.value, 
        };
        // to send a message to the socket. This code will notify when 
        // a user connects to the server.First parameter is the name
        // of the event
        socket.emit('user-connected', currentUser);

        // hide the welcome screen once a user has inputted their
        // name. Then create an instance of "Chat" to process
        // messaging
        this.$welcomeScreen.classList.add("hidden");
        new Chat({ currentUser });
    }

}