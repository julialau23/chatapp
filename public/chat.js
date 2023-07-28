// public/chat.js

class Chat{
    constructor({currentUser}){
        this.currentUser = currentUser;
        this.initializeChat();
        // this function is solely to listen for the broadcast that
        // a new user just logged in
        this.initializeListeners();
    }
    activeChatId = null;
    // store the messages in the browser on the client side. 
    // messages is an array of key-value pairs, where the key
    // is the userId of the recipient and the value is an array
    // of all the messages exchanged between the sender and recipient
    messages = {};
    
    // save a timeout variable to know when to stop displaying "{user} is typing" message
    timeout = undefined;
    typingStatus = false;

    // initializes the chat class by saving necessary information
    // into class variables
    async initializeChat(){
        // the . before the name indicates that it is a class
        this.$chat = document.querySelector(".chat");
        this.$usersList = this.$chat.querySelector(".users-list");
        this.$messagesList = this.$chat.querySelector(".messages-list");
        this.$currentUser = this.$chat.querySelector(".current-user");
        // since input is not a class, we don't need a . before it
        this.$textInput = this.$chat.querySelector("input");
        this.$typingNotif = this.$chat.querySelector(".typing-notif");

        // display all classes under the chat class
        this.$chat.classList.remove("hidden");
        this.$currentUser.innerText = `Logged in as ${this.currentUser.name}`;

        
        // get the API results of the get request to /users
        const users = await this.fetchUsers();
        
        console.log('users', users);

        // call renderUsers AFTER the API results from fetchUsers.
        this.renderUsers(users);
    }


    async fetchUsers() {
        // starts the process of fetching a resource from the network, 
        // returning a promise which is fulfilled once the response is available.
        // once a get request to /users has been made, store this object
        // in res. If successful, res should be the login names of all the users
        // sent in the response to the get request in index.js
        const res = await fetch('/users')
        return await res.json()
    }

    renderUsers(users){
        // if the activeChatId is not in users, then the active chat user was deleted. 
        // reset the activeChatId to null
        var userFound = false;
        // get all users that is not the current user (the user corresponding
        // to the current socket)
        this.users = users.filter((user) => user.id != socket.id);

        // clear the container
        this.$usersList.innerHTML = "";

        // creates a list of users where each user is a div element,
        // with the innertext as the username, and dataset.id as
        // the user id.
        const $users = this.users.map((user) => {
            const $user = document.createElement("div");
            $user.innerText = user.name;
            $user.dataset.id = user.id;
            // while rendering each user, maintain the same activeChatId
            if (user.id == this.activeChatId){
                userFound = true;
                $user.classList.add("active");
            }
            return $user;
        });

        // Populate the container with the array users we just generated
        this.$usersList.append(...$users);

        this.initializeUsersListeners($users);

        // if the user in the activeChat was deleted, reset the activeChatId
        if (userFound == false){
            this.activeChatId = null;
        }

        // if there is no active chat,
        // set the active chat to the first user by default
        if (this.activeChatId == null && this.$usersList.childNodes.length > 0){
            this.activateChat(this.$usersList.querySelector("div"));
        }
    }

    initializeListeners(){
        // if we've received notification from the server side that
        // there was a new login, render users
        socket.on('users-changed', (users) => {
            this.renderUsers(users);
        });
        // This indicates that on the backend, the recipient received
        // the message and emitted the event to us (the client).
        socket.on('new-chat-message', (message) => {

            // add the message we just received to our messages array
            this.addMessage(message.text, message.senderId);

            // if this chat is already open, automatically render message
            if (this.activeChatId == message.senderId){
                this.renderMessage(message.senderId);
            } else {
                this.showNewMessageNotification(message.senderId);
            }
            console.log(message);
        });

        // display that a user is typing to the recipient socket
        socket.on('typing-status', (notif) => {
            if (this.activeChatId == notif.senderId)
            {
                // if this is a notification indicating the sender is typing, display it
                if (notif.typingStatus){
                    const username = this.$usersList.querySelector(`div[data-id="${notif.senderId}"]`).innerText;
                    this.$typingNotif.classList.remove("hidden");
                    // show the typing notification message
                    this.$typingNotif.innerHTML = `${username} is typing...`;
                }
                else{ // otherwise do not display that the user is typing
                    this.$typingNotif.classList.add("hidden");
                    this.$typingNotif.innerHTML = "";
                }
            }
        });
    }

    // add a listener to activate a chat each time a user is clicked
    initializeUsersListeners($users){
        // loop through each DOM model and attach a click event to it
        $users.forEach(($userElement) => {
            $userElement.addEventListener("click", () => {
                this.activateChat($userElement);
            });
        });
    }

    activateChat($userElement){
        // get the userId of the user whos chat was just clicked
        const userId = $userElement.dataset.id;

        // if there is an existing active chat, remove the "active"
        // class from this chat to indicate it is no longer the active
        // chat
        if (this.activeChatId){
            this.$usersList
            .querySelector(`div[data-id="${this.activeChatId}"]`)
            .classList.remove("active");
        }

        // set the active chat to the user that was just clicked
        this.activeChatId = userId;

        // add an active class to that user
        $userElement.classList.add("active");

        // allow us to display input text for this chat
        this.$textInput.classList.remove("hidden");
        this.renderMessage(userId);

        // also remove message notification for this user
        this.$usersList
        .querySelector(`div[data-id="${userId}"]`)
        .classList.remove("has-new-notification");

        // handle typing text as input and pressing enter
        this.$textInput.addEventListener("keyup", (e) => {

            if (e.key == "Enter"){
                const message = {
                    text: this.$textInput.value,
                    // store the recipient so we know who needs to receive
                    // this message
                    recipientId: this.activeChatId,
                };
                socket.emit("new-chat-message", message);

                // add the message to the messages list
                this.addMessage(message.text, message.recipientId);
                this.renderMessage(message.recipientId);
                this.$textInput.value = "";

                // hide typing notif to other user
                this.emitTypingStatus(false, this.activeChatId);
            }
        });
        this.$textInput.addEventListener("input", () => {
            const notif = {};
            if (!this.typingStatus){
                // only emit the message if we aren't already typing
                this.emitTypingStatus(true, this.activeChatId);
            }
            else{
                // otherwise we are already typing, reset the timeout
                clearTimeout(this.timeout);
            }
            // set timeout here. Once timeout has expired, change the typing status
            // to false and broadcast this
            this.timeout = setTimeout(this.emitTypingStatus, 5000, false, this.activeChatId);
     
        });
        
    }

    addMessage(text, userId){
        // if we've never messaged this user before, create
        // an empty list first
        if (!this.messages[userId]){
            this.messages[userId] = []
        }
        // then push the text to the list
        this.messages[userId].push(text);
    }

    renderMessage(userId){
        this.$messagesList.innerHTML = "";

        if (!this.messages[userId]) {
            this.messages[userId] = [];
        }

        const $messages = this.messages[userId].map((message) => {
            const $message = document.createElement("div");
            $message.innerText = message;
            return $message;
        });
        this.$messagesList.append(...$messages);
    }

    showNewMessageNotification(senderId){
        this.$usersList
        .querySelector(`div[data-id="${senderId}"]`)
        .classList.add("has-new-notification");
    }

    // emit the message to the recipient that the user in the chat is typing
    emitTypingStatus(typing, userId){
        this.typingStatus = typing;
        const notif = {
            typingStatus: typing,
            recipientId: userId,
        };
        socket.emit("typing-status", notif);
    }

}