const tmi = require('tmi.js');
const axios = require('axios');

// Spaces on a Chess Board
const spaces = [
    'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
    'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
    'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
    'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
    'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8',
];

// Special Endings to a Move
const endings = [
    '!', '?', '+', 'e.p.', '#', "."
];

// Pieces on a Chess Board
const pieces = [
    'k', 'q', 'b', 'n', 'r', '', 'ka', 'kb', 'na', 'nb', 'qx', 'ra', 'rb'
];

// Unique moves
const unique = [
    '0-0', '0-0-0', 'o-o', 'o-o-o'
];

// Options for connecting Twitch Bot to Twitch
const options = {
    options: {
        debug: true,
    },
    connection: {
        cluser: 'aws',
        reconnect: true,
    },
    identity: {
        username: null,
        password: null
    },
    channels: []
};

document.querySelector("#channels").value = localStorage.getItem("channels");
document.querySelector("#username").value = localStorage.getItem("username");
document.querySelector("#oauth-token").value = localStorage.getItem("oauth-token");

const startButton = document.querySelector("#button-start-bot");
startButton.addEventListener("click", () => {
    options.identity.username = document.querySelector("#username").value;
    options.identity.password = document.querySelector("#oauth-token").value;

    startButton.disabled = "true";

    const channelList = document.querySelector("#channels").value.split(/\s+/);

    options.channels = channelList;
    console.log(options.channels);

    localStorage.setItem("channels", document.querySelector("#channels").value);
    localStorage.setItem("username", document.querySelector("#username").value);
    localStorage.setItem("oauth-token", document.querySelector("#oauth-token").value);

    let hintsDestroyed = 0;
    let startTime = new Date();

    // Setting up Connection with Twitch with our options
    const client = new tmi.client(options);

    client.on("connected", () => {
        document.querySelector("#status").classList.remove("status-failed");
        document.querySelector("#status").classList.add("status-success");
    });

    ["crash", "disconnected", "connectfail", "crash"].forEach(ev => {
        client.on(ev, () => {
            document.querySelector("#status").classList.remove("status-success");
            document.querySelector("#status").classList.add("status-failed");
        });
    });

    // Connecting to Twitch
    client.connect();

    // Initializing Channel Data in memory
    let channels = [];
    for (let i = 0; i < channelList.length; i++) {
        let data = {
            channel: channelList[i],
            isOn: false,
            hintsDestroyed: 0
        };

        channels.push(data);
    }

    // Action when a user chats from any of the channels
    client.on('chat', (channel, user, message, self) => {
        // Set message to all lowercase to make it easier to check
        message = message.toLowerCase();

        for (let t = 0; t < channels.length; t++) {
            if (channels[t].channel == channel) {
                let tokens = message.split(' ');
                if (tokens[0] == "!c" && tokens[1] == "rating" && tokens.length == 4) {
                    axios.get(`https://api.chess.com/pub/player/${tokens[3]}/stats`).then(res => {
                        console.log(res.data);

                        if (tokens[2] == "bullet" && res.data.chess_bullet) {
                            let bulletRank = res.data.chess_bullet.last.rating;
                            client.action(channel.slice(1,channel.length), 'has found a rating of ' + bulletRank + ' for Bullet Chess.');
                        } else if (tokens[2] == "blitz" && res.data.chess_blitz) {
                            let blitzRank = res.data.chess_blitz.last.rating;
                            client.action(channel.slice(1,channel.length), 'has found a rating of ' + blitzRank + ' for Blitz Chess.');
                        } else if (tokens[2] == "rapid" && res.data.chess_rapid) {
                            let rapidRank = res.data.chess_rapid.last.rating;
                            client.action(channel.slice(1,channel.length), 'has found a rating of ' + rapidRank + ' for Rapid Chess.');
                        } else {
                            client.action(channel.slice(1,channel.length), 'has found no rating.');
                        }
                    });
                    //
                }

                if ((user.mod || user.username == channel.slice(1,channel.length)) && message == "!c on") {
                    channels[t].isOn = true;
                    client.action(channel.slice(1,channel.length), 'has been ACTIVATED! No giving moves.');
                }

                if ((user.mod || user.username == channel.slice(1,channel.length)) && message == "!c off") {
                    channels[t].isOn = false;
                    client.action(channel.slice(1,channel.length), 'has been DEACTIVATED. You are free to give moves.');
                }

                if (message == "!c stats") {
                    client.action(channel.slice(1,channel.length), 'has destroyed ' + hintsDestroyed + " hints.");
                }

                if (message == "!c uptime") {
                    let endTime = new Date();
                    client.action(channel.slice(1,channel.length), 'has been up for ' + ((endTime.getTime() - startTime.getTime()) / 1000) + ' seconds.');
                }

                if (channels[t].isOn && !(user.mod || user.username == channel.slice(1,channel.length))) {
                    message = ' ' + message + ' ';

                    let found = false;
                    for (let i = 0; i < spaces.length; i++) {
                        let str = " " + spaces[i] + " ";

                        if (message.includes(str)) {
                            found = true;
                            i = spaces.length;
                        }

                        if (!found) {
                            for (let j = 0; j < pieces.length; j++) {
                                let pieceAndSpace = ' ' + pieces[j] + spaces[i] + ' ';
                                let capturePieceAndSpace = ' ' + pieces[j] + 'x' + spaces[i] + ' ';
                                if (message.includes(pieceAndSpace) || message.includes(capturePieceAndSpace)) {
                                    found = true;
                                    j = pieces.length;
                                }
                            }
                        }
                    }

                    if(!found) {
                        for (let i = 0; i < unique.length; i++) {
                            let str = " " + unique[i] + " ";
                            if (message.includes(str)) {
                                found = true;
                                i = unique.length;
                            }
                        }
                    }

                    if (found) {
                        client.action(channel.slice(1,channel.length), 'has detected a move! Please no sharing moves at this time.');
                        client.timeout(channel.slice(1,channel.length), user.username, 1, "Hint in chess.");
                        hintsDestroyed++;
                    }
                }
            }
        }
    });
});
