const auth = require('@twurple/auth');
const chat = require('@twurple/chat');
const api  = require('@twurple/api');
const apiCall  = require('@twurple/api-call');
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

document.querySelector("#channels").value = localStorage.getItem("channels");

const CLIENT_ID = "y9xa0xv2nkjzhc8md2jbe4i1eocsvk";

const accessMatch = document.location.hash.match(/access_token=([^&]+)/);
if (accessMatch)
    localStorage.setItem("access-token", accessMatch[1]);

const startButton = document.querySelector("#button-start-bot");
startButton.addEventListener("click", async () => {
    const accessToken = localStorage.getItem("access-token");

    const authProvider = new auth.StaticAuthProvider(CLIENT_ID, accessToken);

    startButton.disabled = "true";

    const channelList = document.querySelector("#channels").value.split(/\s+/);

    const client = new chat.ChatClient({ authProvider, channels: channelList });
    await client.connect();

    localStorage.setItem("channels", document.querySelector("#channels").value);
    localStorage.setItem("access-token", accessToken);

    let hintsDestroyed = 0;
    let startTime = new Date();

    document.querySelector("#status").classList.add("status-success");

    // Initializing Channel Data in memory
    let channels = {};

    const selfUserResponse = await apiCall.callTwitchApi(
        {type: 'helix', url: 'users'}, CLIENT_ID, accessToken);
    const selfUser = selfUserResponse.data[0].id;

    if (!selfUser) {
        document.querySelector("#status").classList.add("status-success");
        document.querySelector("#status").classList.add("status-failed");
    }

    const apiClient = new api.ApiClient(authProvider);

    // Action when a user chats from any of the channels
    client.onMessage(async (channel, user, message, msgData) => {
        console.log(`[${channel}] ${user} <- ${message}`);
        user = msgData.userInfo;
        // Set message to all lowercase to make it easier to check
        message = message.toLowerCase();

        if (!channels[channel]) {
            channels[channel] = {isOn: false, hintsDestroyed: 0};
        }

        const chanData = channels[channel];

        let tokens = message.split(' ');
        if (tokens[0] == "!c" && tokens[1] == "rating" && tokens.length == 4) {
            axios.get(`https://api.chess.com/pub/player/${tokens[3]}/stats`).then(res => {
                console.log(res.data);

                if (tokens[2] == "bullet" && res.data.chess_bullet) {
                    let bulletRank = res.data.chess_bullet.last.rating;
                    client.say(channel, 'has found a rating of ' + bulletRank + ' for Bullet Chess.');
                } else if (tokens[2] == "blitz" && res.data.chess_blitz) {
                    let blitzRank = res.data.chess_blitz.last.rating;
                    client.say(channel, 'has found a rating of ' + blitzRank + ' for Blitz Chess.');
                } else if (tokens[2] == "rapid" && res.data.chess_rapid) {
                    let rapidRank = res.data.chess_rapid.last.rating;
                    client.say(channel, 'has found a rating of ' + rapidRank + ' for Rapid Chess.');
                } else {
                    client.say(channel, 'has found no rating.');
                }
            });
        }

        if ((user.isMod || user.isBroadcaster) && message == "!c on") {
            chanData.isOn = true;
            client.say(channel, 'has been ACTIVATED! No giving moves.');
        }

        if ((user.isMod || user.isBroadcaster) && message == "!c off") {
            chanData.isOn = false;
            client.say(channel, 'has been DEACTIVATED. You are free to give moves.');
        }

        if (message == "!c stats") {
            client.say(channel, 'has destroyed ' + hintsDestroyed + " hints.");
        }

        if (message == "!c uptime") {
            let endTime = new Date();
            client.say(channel, 'has been up for ' + ((endTime.getTime() - startTime.getTime()) / 1000) + ' seconds.');
        }

        if (chanData.isOn && !(user.isMod || user.isBroadcaster)) {
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
                client.say(channel, 'has detected a move! Please no sharing moves at this time.');
                const broadcaster = await apiClient.users.getUserByName(channel.slice(1));
                await apiClient.moderation.deleteChatMessages(broadcaster, selfUser, msgData.id);
                hintsDestroyed++;
            }
        }
    });
});
